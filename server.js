const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const { UserCollection, AdminCollection } = require("./src/config");
const bcrypt = require('bcrypt');
const session = require('express-session');

require('dotenv').config();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static("public"));
app.set("view engine", "ejs");

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
}));

mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log("Connected to MongoDB");
}).catch((error) => {
    console.error("Error connecting to MongoDB:", error);
});

// Route to render main page
app.get("/", async (req, res) => {
    const users = await UserCollection.find({ rating: { $ne: null } }).sort({ rating: -1 }).exec();
    const admin = await AdminCollection.findOne({});
    const budgetStudents = admin ? admin.budgetStudents : 0;
    const isAdmin = req.session.isAdmin;
    const isLoggedIn = req.session.isAdmin || req.session.isUser;
    res.render("main", { users, isAdmin, isLoggedIn, budgetStudents });
});

// Route to render login page
app.get("/login", (req, res) => {
    res.render("login");
});

// Route to handle login logic
app.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;
        const admin = await AdminCollection.findOne({ username });

        if (admin) {
            const isPasswordMatch = await bcrypt.compare(password, admin.password);
            if (isPasswordMatch) {
                req.session.isAdmin = true;
                req.session.isUser = false;
                req.session.username = username;
                res.redirect("/");
                return;
            }
        } else {
            const user = await UserCollection.findOne({ username });
            if (user) {
                const isPasswordMatch = await bcrypt.compare(password, user.password);
                if (isPasswordMatch) {
                    req.session.isUser = true;
                    req.session.isAdmin = false;
                    req.session.username = username;
                    res.redirect("/");
                    return;
                }
            }
        }
        res.send("Invalid username or password");
    } catch (error) {
        res.status(500).send("Internal Server Error");
    }
});

// Route to handle logout logic
app.get("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).send("Could not log out.");
        }
        res.redirect("/");
    });
});

// Route to render profile page
app.get("/profile", async (req, res) => {
    if (req.session.isAdmin) {
        const users = await UserCollection.find().exec();
        res.render("adminProfile", { users });
    } else if (req.session.isUser) {
        const user = await UserCollection.findOne({ username: req.session.username }).exec();
        res.render("userProfile", { user });
    } else {
        res.redirect("/login");
    }
});

// Route to render edit user page
app.get("/editUser/:id", async (req, res) => {
    if (!req.session.isAdmin) {
        return res.redirect("/login");
    }
    const user = await UserCollection.findById(req.params.id);
    if (!user) {
        return res.status(404).send("User not found");
    }
    res.render("editUser", { user });
});

// Route to handle updating budget
app.post("/updateBudget", async (req, res) => {
    if (!req.session.isAdmin) {
        return res.status(403).send("Forbidden");
    }
    const newBudget = parseInt(req.body.budgetStudents, 10);
    await AdminCollection.updateOne({ username: req.session.username }, { budgetStudents: newBudget });
    res.redirect("/");
});

// Route to render add user page
app.get("/addUser", (req, res) => {
    if (!req.session.isAdmin) {
        return res.redirect("/login");
    }
    res.render("addUser");
});

// Function to calculate the average mark
function calculateAverageMark(subjects) {
    if (subjects.length === 0) return null; // No subjects, no average
    const totalMarks = subjects.reduce((sum, subject) => {
        if (subject.mark === undefined || subject.mark === null) return sum + 0;
        return sum + parseFloat(subject.mark);
    }, 0);
    if (totalMarks === 0) return null; // No marks
    return totalMarks / subjects.length;
}

// Function to calculate the rating mark
function calculateRatingMark(averageMark, additionalMarks) {
    return parseFloat((averageMark * 0.95 + additionalMarks * 0.05).toFixed(2));
}

// Route to handle editing user
app.post("/editUser/:id", async (req, res) => {
    if (!req.session.isAdmin) {
        return res.status(403).send("Forbidden");
    }

    const { username, password, name, surname, group, additionalMarks } = req.body;

    let subjects = [];
    Object.keys(req.body).forEach(key => {
        const match = key.match(/subjects\[(\d+)\]\[(\w+)\]/);
        if (match) {
            const index = match[1];
            const field = match[2];
            subjects[index] = subjects[index] || {};
            subjects[index][field] = req.body[key];
        }
    });

    const user = await UserCollection.findById(req.params.id);
    if (!user) {
        return res.status(404).send("User not found");
    }

    user.username = username;
    user.name = name;
    user.surname = surname;
    user.group = group;
    user.additionalMarks = additionalMarks;
    user.subjects = subjects;

    if (password) {
        const saltRounds = 10;
        user.password = await bcrypt.hash(password, saltRounds);
    }

    // Calculate average and rating marks
    const averageMark = calculateAverageMark(subjects);
    if (averageMark !== null) {
        user.averageMark = averageMark;
        const ratingMark = calculateRatingMark(averageMark, additionalMarks);
        user.rating = ratingMark;
    } else {
        user.averageMark = null;
        user.rating = null;
    }

    await user.save();
    res.redirect("/profile");
});

// Route to handle adding user
app.post("/addUser", async (req, res) => {
    if (!req.session.isAdmin) {
        return res.status(403).send("Forbidden");
    }

    const { username, password, name, surname, group, additionalMarks } = req.body;

    let subjects = [];
    Object.keys(req.body).forEach(key => {
        const match = key.match(/subjects\[(\d+)\]\[(\w+)\]/);
        if (match) {
            const index = match[1];
            const field = match[2];
            subjects[index] = subjects[index] || {};
            subjects[index][field] = req.body[key];
        }
    });

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Calculate average and rating marks
    const averageMark = calculateAverageMark(subjects);
    let ratingMark = null;
    if (averageMark !== null) {
        ratingMark = calculateRatingMark(averageMark, additionalMarks);
    }

    const newUser = new UserCollection({
        username,
        password: hashedPassword,
        name,
        surname,
        group,
        subjects,
        additionalMarks,
        averageMark,
        rating: ratingMark
    });

    await newUser.save();
    res.redirect("/profile");
});

const port = 5000;
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
