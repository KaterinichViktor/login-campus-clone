require('dotenv').config();
const express = require("express");
const path = require("path");
const { UserCollection, AdminCollection } = require("./src/config");
const bcrypt = require('bcrypt');
const session = require('express-session');
const crypto = require('crypto');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public"))); // Serve static files from the public directory
app.set("view engine", "ejs");

app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
}));

// app.get("/", async (req, res) => {
//     const users = await UserCollection.find({ rating: { $ne: null } }).sort({ rating: -1 }).exec();
//     const admin = await AdminCollection.findOne({});
//     const budgetStudents = admin ? admin.budgetStudents : 0;
//     const isAdmin = req.session.isAdmin;
//     const isLoggedIn = req.session.isAdmin || req.session.isUser;
//     res.render("main", { users, isAdmin, isLoggedIn, budgetStudents });
// });

// Home route with faculty filtering
// app.get("/", async (req, res) => {
//     const selectedFaculty = req.query.faculty || 'all';
//     let users;
    
//     if (selectedFaculty === 'all') {
//         users = await UserCollection.find({ rating: { $ne: null } }).sort({ rating: -1 }).exec();
//     } else {
//         users = await UserCollection.find({ faculty: selectedFaculty, rating: { $ne: null } }).sort({ rating: -1 }).exec();
//     }

//     const faculties = await UserCollection.distinct('faculty');
//     const admin = await AdminCollection.findOne({});
//     const budgetStudents = admin ? admin.budgetStudents : 0;
//     const isAdmin = req.session.isAdmin;
//     const isLoggedIn = req.session.isAdmin || req.session.isUser;

//     res.render("main", { users, faculties, selectedFaculty, isAdmin, isLoggedIn, budgetStudents });
// });


// Home route with faculty filtering
app.get("/", async (req, res) => {
    try {
        const selectedFaculty = req.query.faculty || 'ІТС'; // Default to the first faculty
        const admin = await AdminCollection.findOne({ username: "admin" });

        if (!admin) {
            return res.status(500).send("Admin data not found");
        }

        const facultyData = admin.faculties.find(f => f.faculty === selectedFaculty);
        if (!facultyData) {
            return res.status(404).send("Faculty data not found");
        }
        
        const budgetStudents = facultyData.budgetStudents;

        const users = await UserCollection.find({ faculty: selectedFaculty, rating: { $ne: null } }).sort({ rating: -1 }).exec();
        const faculties = admin.faculties.map(f => f.faculty); // get list of all faculties
        const isAdmin = req.session.isAdmin;
        const isLoggedIn = req.session.isAdmin || req.session.isUser;

        res.render("main", { users, faculties, selectedFaculty, isAdmin, isLoggedIn, budgetStudents });
    } catch (error) {
        console.error("Error fetching data:", error);
        res.status(500).send("Internal Server Error");
    }
});

app.post("/updateBudget", async (req, res) => {
    try {
        if (!req.session.isAdmin) {
            return res.status(403).send("Forbidden");
        }

        const { faculty, budgetStudents } = req.body;
        const admin = await AdminCollection.findOne({ username: "admin" });

        if (!admin) {
            return res.status(500).send("Admin data not found");
        }

        const facultyData = admin.faculties.find(f => f.faculty === faculty);

        if (facultyData) {
            facultyData.budgetStudents = parseInt(budgetStudents, 10);
            await AdminCollection.updateOne({ username: "admin" }, { $set: { faculties: admin.faculties } });
        } else {
            return res.status(404).send("Faculty not found");
        }

        res.redirect(`/?faculty=${faculty}`);
    } catch (error) {
        console.error("Error updating budget students:", error);
        res.status(500).send("Internal Server Error");
    }
});


app.get("/login", (req, res) => {
    res.render("login");
});

app.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;
        const secretWord = process.env.SECRET_WORD;
        const loginString = `${username}:${password}:${secretWord}`;
        const hashedLoginString = crypto.createHash('sha256').update(loginString).digest('hex');

        // Check if the hashed login string matches the stored hash
        const admin = await AdminCollection.findOne({ loginString: hashedLoginString });
        if (admin) {
            req.session.isAdmin = true;
            req.session.isUser = false;
            req.session.username = username;
            res.redirect("/");
            return;
        }

        const user = await UserCollection.findOne({ loginString: hashedLoginString });
        if (user) {
            req.session.isUser = true;
            req.session.isAdmin = false;
            req.session.username = username;
            res.redirect("/");
            return;
        }

        res.send("Invalid username or password");
    } catch (error) {
        res.status(500).send("Internal Server Error");
    }
});

app.get("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).send("Could not log out.");
        }
        res.redirect("/");
    });
});

app.get("/profile", async (req, res) => {
    if (req.session.isAdmin) {
        const users = await UserCollection.find().exec();
        const admins = await AdminCollection.find().exec(); // Fetch admins from the database
        res.render("adminProfile", { users, admins }); // Pass admins to the template
    } else if (req.session.isUser) {
        const user = await UserCollection.findOne({ username: req.session.username }).exec();
        res.render("userProfile", { user });
    } else {
        res.redirect("/login");
    }
});


// Route to serve the edit user page
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

// app.post("/updateBudget", async (req, res) => {
//     if (!req.session.isAdmin) {
//         return res.status(403).send("Forbidden");
//     }
//     const newBudget = parseInt(req.body.budgetStudents, 10);
//     // await AdminCollection.updateOne({ username: req.session.username }, { budgetStudents: newBudget });
//     await AdminCollection.updateOne({}, { budgetStudents: newBudget });
//     res.redirect("/");
// });

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
        if (!subject.mark) return sum + null;
        return sum + parseFloat(subject.mark);
    }, 0);

    if (totalMarks === null) return null; // Not all subjects have marks

    return Math.round((totalMarks / subjects.length) * 100) / 100; // Round to 2 decimal places
}

// Function to calculate the rating mark
function calculateRatingMark(averageMark, additionalMarks) {
    return Math.round((averageMark * 0.95 + additionalMarks * 0.05) * 100) / 100; // Round to 2 decimal places
}

// Edit User
app.post("/editUser/:id", async (req, res) => {
    if (!req.session.isAdmin) {
        return res.status(403).send("Forbidden");
    }

    const { username, password, name, surname, patronymic, faculty, group, additionalMarks } = req.body;

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

    user.name = name;
    user.surname = surname;
    user.patronymic = patronymic;
    user.faculty = faculty;
    user.group = group;
    user.additionalMarks = additionalMarks;
    user.subjects = subjects;

    if (username !== user.username || password) {
        const secretWord = process.env.SECRET_WORD;
        const loginString = `${username}:${password}:${secretWord}`;
        const hashedLoginString = crypto.createHash('sha256').update(loginString).digest('hex');
        user.loginString = hashedLoginString;
        // user.username = hashedLoginString;
    }

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

// Add User
app.post("/addUser", async (req, res) => {
    if (!req.session.isAdmin) {
        return res.status(403).send("Forbidden");
    }

    const { username, password, name, surname, patronymic, faculty, group, additionalMarks } = req.body;

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

    const secretWord = process.env.SECRET_WORD;
    const loginString = `${username}:${password}:${secretWord}`;
    const hashedLoginString = crypto.createHash('sha256').update(loginString).digest('hex');

    // Calculate average and rating marks
    const averageMark = calculateAverageMark(subjects);
    let ratingMark = null;
    if (averageMark !== null) {
        ratingMark = calculateRatingMark(averageMark, additionalMarks);
    }

    const newUser = new UserCollection({
        loginString: hashedLoginString, // Store the hashed login string
        username: username,
        password: hashedPassword,
        name,
        surname,
        patronymic,
        faculty,
        group,
        subjects,
        additionalMarks,
        averageMark,
        rating: ratingMark
    });

    await newUser.save();
    res.redirect("/profile");
});


// Edit Admin
app.post("/editAdmin/:id", async (req, res) => {
    if (!req.session.isAdmin) {
        return res.status(403).send("Forbidden");
    }

    const { username, password } = req.body;
    const admin = await AdminCollection.findById(req.params.id);
    if (!admin) {
        return res.status(404).send("Admin not found");
    }

    const secretWord = process.env.SECRET_WORD;
    const loginString = `${username}:${password}:${secretWord}`;
    const hashedLoginString = crypto.createHash('sha256').update(loginString).digest('hex');

    admin.username = username;
    admin.loginString = hashedLoginString;

    await admin.save();
    res.redirect("/");
});


// Add Admin
app.post("/addAdmin", async (req, res) => {
    if (!req.session.isAdmin) {
        return res.status(403).send("Forbidden");
    }

    const { username, password } = req.body;

    const secretWord = process.env.SECRET_WORD;
    const loginString = `${username}:${password}:${secretWord}`;
    const hashedLoginString = crypto.createHash('sha256').update(loginString).digest('hex');

    const newAdmin = new AdminCollection({
        username: username,
        loginString: hashedLoginString, // Store the hashed login string
    });

    await newAdmin.save();
    res.redirect("/profile");
});

app.post("/deleteAdmin/:id", async (req, res) => {
    if (!req.session.isAdmin) {
        return res.status(403).send("Forbidden");
    }

    await AdminCollection.findByIdAndDelete(req.params.id);
    res.redirect("/profile");
});

app.post('/deleteUser/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        await UserCollection.findByIdAndDelete(userId);
        res.redirect('/profile'); // Redirect to the admin profile page after deletion
    } catch (error) {
        console.error(error);
        res.status(500).send('Error deleting user');
    }
});

const port = process.env.PORT || 5000;
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
