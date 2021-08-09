const express = require('express');
const app = express();
var router = express.Router();
let ejs = require('ejs');
const bodyParser = require('body-parser');
const firebase = require('firebase');
var storage = require('firebase/storage');
var admin = require("firebase-admin");
var favicon = require('serve-favicon');
var multer = require('multer');
var md5 = require('md5');

//for static files
app.use(express.static('static'));
app.use(favicon(__dirname + '/static/images/logo/favicon.png'));

//get form data using json
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

//Firebase configurations
var firebaseConfig = {
  apiKey: "AIzaSyAVpnGuapjU3HaCGa-CmBHidWrOGV2RSBI",
  authDomain: "pwa-firebase-hosting.firebaseapp.com",
  databaseURL: "https://pwa-firebase-hosting.firebaseio.com/",
  projectId: "pwa-firebase-hosting",
  storageBucket: "pwa-firebase-hosting.appspot.com",
  messagingSenderId: "72415286155"
};
firebase.initializeApp(firebaseConfig);

//firebase-admin configuration
var serviceAccount = require("./firebase-adminsdk-slnc4-f89977bb82.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://pwa-firebase-hosting.firebaseio.com/",
  storageBucket: "pwa-firebase-hosting.appspot.com"
});
var bucket = admin.storage().bucket();
var db = admin.database();

//multer
var upload = multer({
  storage: multer.memoryStorage()
});

function isAuthenticated(req, res, next) {
  var user = firebase.auth().currentUser;

  if (user) {
    next();
  }
  else {
    res.redirect("/login");
  }
}

//GET:/. This also sends the data for dashboard
app.get("/", isAuthenticated, function (req, res) {
  var ref = db.ref();

  ref.once("value").then(function (snapshot) {
    val = snapshot.val();
    timestampVal = val.TimeStamp;
    userVal = val.userProfile;
    res.render(__dirname + "/pages/dashboard.ejs", {timestampData: timestampVal, userData: userVal});
  });
});

//GET:/login
app.get("/login", function (req, res) {
  res.render(__dirname + "/pages/login.ejs");
});

//POST:/login
app.post("/login", function (req, res) {
  var email = req.body.email;
  var password = req.body.password;

  firebase.auth().signInWithEmailAndPassword(email, password).then(function (user) {
    //Once the user has given the correct email and password, check the role of the user
    console.log(user.user.uid + ' signed in.');
    var ref = db.ref('userProfile/' + user.user.uid + '/role');

    // Attach an asynchronous callback to read the data at our posts reference
    ref.once("value").then(function (snapshot) {
      if (JSON.stringify(snapshot) != '"Admin"') {
        firebase.auth().signOut();
        res.render(__dirname + "/pages/login.ejs", { errMsg: 'You do not have the permission to access this page.' })
      }
      else {
        res.redirect("/");
      }
    }).catch(function (error) {
      console.log("The read failed: " + errorObject.code);
      firebase.auth().signOut();
    });
  }).catch(function (error) {
    if (error.code == "auth/invalid-email" || error.code == "auth/user-not-found" || error.code == "auth/wrong-password") {
      res.render(__dirname + "/pages/login.ejs", { errMsg: 'Invalid email or password.' })
    }
  });
});

//GET:/logout
app.get("/logout", function (req, res) {
  firebase.auth().signOut().then(function () {
    res.redirect("/login");
  }).catch(function (error) {
    // An error happened.
  });
});

//GET:/beacons
app.get("/beacons", isAuthenticated, function (req, res) {
  res.render(__dirname + "/pages/beacons.ejs");
});

//GET:/beacons
app.get("/beaconDirections", isAuthenticated, function (req, res) {
  res.render(__dirname + "/pages/beacon_directions.ejs");
});

//GET:/beacons
app.get("/beaconRelations", isAuthenticated, function (req, res) {
  res.render(__dirname + "/pages/beacon_relations.ejs");
});

//GET:/units
app.get("/units", isAuthenticated, function (req, res) {
  res.render(__dirname + "/pages/units.ejs");
});

//POST:/units
app.post("/unitsImage", isAuthenticated, upload.single('inputImage'), function (req, res) {
  let file = req.file;
  let fileUpload = bucket.file('images/units/' + file.originalname);
  const blobStream = fileUpload.createWriteStream({
    metadata: {
      contentType: 'image/jpeg'
    }
  });

  blobStream.end(file.buffer);

  fileUpload.getSignedUrl({ action: 'read', expires: '01-01-9999' }, function (err, url) {
    res.json(url);
  });
});

//GET:/facilities
app.get("/facilities", isAuthenticated, function (req, res) {
  res.render(__dirname + "/pages/facilities.ejs");
});

//POST:/facilities
app.post("/facilitiesImage", isAuthenticated, upload.single('inputImage'), function (req, res) {
  let file = req.file;
  let fileUpload = bucket.file('images/facilities/' + file.originalname);
  const blobStream = fileUpload.createWriteStream({
    metadata: {
      contentType: 'image/jpeg'
    }
  });

  blobStream.end(file.buffer);

  fileUpload.getSignedUrl({ action: 'read', expires: '01-01-9999' }, function (err, url) {
    res.json(url);
  });
});

//GET:/users
app.get("/users", isAuthenticated, function (req, res) {
  res.render(__dirname + "/pages/users.ejs");
});

//POST:/users. This API registers a user to the database.
app.post("/users", isAuthenticated, function (req, res) {
  admin.auth().createUser({
    email: req.body.email,
    emailVerified: false,
    password: req.body.password,
    displayName: req.body.name
  }).then(function (userRecord) {
    var ref = db.ref("userProfile").child(userRecord.uid);
    ref.set({
      dateOfBirth: req.body.dob,
      email: req.body.email,
      gender: req.body.gender,
      loginType: 'email',
      name: req.body.name,
      password: md5(req.body.password),
      profileURL: '',
      role: req.body.role
    });

    console.log("Successfully created new user:", userRecord.uid);
    res.end();
  }).catch(function (error) {
    console.log('Error creating new user:' + error);
    res.status(500).send(error);
  });
});

//GET:/usersData. This API gets the JSON of all the users. Better to separate because of updating, dont need to refresh page
app.get("/usersData", isAuthenticated, function (req, res) {
  // Get a database reference to our posts
  var ref = db.ref('userProfile');

  // Attach an asynchronous callback to read the data at our posts reference
  ref.once("value").then(function (snapshot) {
    res.json(snapshot.val());
  }).catch(function (error) {
    console.log("The read failed: " + errorObject.code);
    res.status(500).send(error);
  });
});

//GET:/users/:uid. This API gets the role of the user data
app.get("/users/:uid", isAuthenticated, function (req, res) {
  // Get a database reference to our posts
  var uid = req.params.uid;
  var ref = db.ref('userProfile/' + uid + '/role');

  // Attach an asynchronous callback to read the data at our posts reference
  ref.once("value").then(function (snapshot) {
    res.json(snapshot.val());
  }).catch(function (error) {
    console.log("The read failed: " + errorObject.code);
    res.status(500).send(error);
  });
});

//PUT:/users/:uid. This API saves the role of the user data
app.put("/users/:uid", isAuthenticated, function (req, res) {
  var uid = req.params.uid;
  var updateRole = req.body.role;
  var ref = db.ref('userProfile/' + uid);
  ref.update({
    role: updateRole
  }).then(function() {
    res.end();
  }).catch(function(error) {
    res.status(500).send(error);
  })
});

app.listen(3000, () => console.log('Example app listening on port 3000!'))