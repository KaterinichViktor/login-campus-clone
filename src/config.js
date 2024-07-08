const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log("Connected to MongoDB");
}).catch((error) => {
    console.error("Error connecting to MongoDB:", error);
});

const UserSchema = new mongoose.Schema({
    loginString: String,
    username: String,
    password: String,
    name: String,
    surname: String,
    patronymic: String,
    group: String,
    subjects: [{
        subject: String,
        teacher: String,
        mark: Number
    }],
    additionalMarks: Number,
    rating: Number,
    averageMark: Number,
});

const AdminSchema = new mongoose.Schema({
    loginString: String,
    username: String,
    password: String,
    budgetStudents: Number
});

const UserCollection = mongoose.model('User', UserSchema);
const AdminCollection = mongoose.model('Admin', AdminSchema);

module.exports = { UserCollection, AdminCollection };
