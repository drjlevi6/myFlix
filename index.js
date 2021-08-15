//require('dotenv').config();
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

const cors = require('cors');
let allowedOrigins = ['*'];
app.use(cors());
/*app.use(cors({
  origin: (origin, callback) => {
    if(!origin) return callback(null, true);
    if(allowedOrigins.indexOf(origin) === -1){ // If a specific origin isn’t found on the list of allowed origins
      let message = 'The CORS policy for this application doesn’t allow access from origin ' + origin;
      return callback(new Error(message ), false);
    }
    return callback(null, true);
  }
}));*/
let auth = require('./auth')(app);
const passport = require('passport');
require('./passport');

const { check, validationResult } = require('express-validator'); // 2.10
const mongoose = require('mongoose');
const Models = require('./models.js');

const Movies = Models.Movie;
const Users = Models.User;

// (See offline notes re connection string)
mongoose.connect( String(process.env.CONNECTION_URI) + 
	' || mongodb://localhost:27017/myFlix', 
  { useNewUrlParser: true, useUnifiedTopology: true });
  
//Display a welcome message:
app.get('/', (req, res) => {
  res.status(201).send('Welcome to Dr. Levi\'s movie application!\n' + 
    'Please register to view our lists of movies, directors, genres and more!');
});

// Get documentation page
app.get('/documentation', (req, res) => {
	var path = require('path');
	res.sendFile(
		path.join( __dirname, '/public/documentation.html'));
});

//Add a user
/* We start with JSON in this format
{
  ID: Integer,
  Username: String,
  Password: String,
  Email: String,
  Birthday: Date
}
but the actual user object's password will be hashed
*/
  app.post('/users', 
    // Validation logic here for request
    [
      check('Username', 'Username is required').isLength({min: 5}),
      check('Username', 'Username contains non alphanumeric characters' +
      ' - not allowed.').isAlphanumeric(),
      check('Email', 'Email does not appear to be valid').isEmail()
    ], (req, res) => {

    // check the validation object for errors
    let errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }
    
    let hashedPassword = Users.hashPassword(req.body.Password);

    // Search to see if a user with the requested username already exists
    Users.findOne({ Username: req.body.Username })
      .then((user) => {
        if (user) {
          // If the user is found, send a response that it already exists
          return res.status(400).send(req.body.Username + ' already exists');
        } else {
          Users.create({
              Username: req.body.Username,
              Password: hashedPassword,
              Email: req.body.Email,
              Birthday: req.body.Birthday
            })
            .then((user) => {
              res.status(201).json(user)
            })
          .catch((error) => {
            console.error(error);
            res.status(500).send('Error: ' + error);
          });
        }
      })
      .catch((error) => {
        console.error(error);
        res.status(500).send('Error: ' + error);
      });
  });
  
// Get all users
//app.get('/users/',passport.authenticate('jwt', { session: false }), (req, res) => {
app.get('/users/', (req, res) => {
Users.find()
      .then((users) => {
        res.status(201).json(users);
      })
      .catch((err) => {
        console.error(err);
        res.status(500).send('Error: ' + err);
      });
  });
 
// Get a user by username
app.get('/users/:Username', passport.authenticate('jwt', { session: false }), 
		(req, res) => {
    Users.findOne({ Username: req.params.Username })
      .then((user) => {
        res.json(user);
      })
      .catch((err) => {
        console.error(err);
        res.status(500).send('Error: ' + err);
      });
  });

// Get all data about a specified movie
app.get('/movies/:name', passport.authenticate('jwt', { session: false }), 
		(req, res) => {
  Movies.findOne({ title:req.params.name }).then(movie => {
      res.json(movie);
  }).catch((err) => {
      console.error(err);
      res.status(500).send('Error: ' + err);
    });
})

// Get all movies
// passport.authenticate('jwt', { session: false }), 

app.get('/movies', 
		(req, res) => {
  Movies.find()
    .then((movies) => {
      res.status(201).json(movies);
    })
    .catch((err) => {
      console.log('Caught error');
      console.error(err);
      res.status(500).send('Error: ' + err);
    });
});

// Get genre of a specific movie
app.get('/movies/genre/:itsTitle', passport.authenticate('jwt', 
		{ session: false }), (req, res) => { 
  Movies.findOne({ title:req.params.itsTitle }).select("genre")
  .then((genre) => {
    res.status(201).json(genre);
  })
  .catch((err) => {
    console.error(err);
    res.status(500).send('Error: ' + err);
  });
});

// Get info about a genre by its name
app.get('/movies/genre/name/:Name', passport.authenticate('jwt', 
		{ session: false }), (req, res) => {
  Movies.findOne(
    { 'genre.name': req.params.Name },
    {genre: 1, _id: 0}).then((Genre) => {
      res.status(201).json( Genre );
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send('Error: ' + err)
    });
  });

// Get info about a director (by their name)
app.get('/movies/director/:Name', passport.authenticate('jwt', 
		{ session: false }), (req, res) => {
  console.log(req.params);
  Movies.findOne(
    { 'director.name': req.params.Name },
    { director: 1, _id: 0 }).then((itsDirector) => {
      res.status(201).json( itsDirector ); 
    })
  .catch((err) => {
    console.error(err);
    res.status(500).send('Error: ' + err)
  });
});

// Update a user's info, by username
/* We’ll expect JSON in this format
{
  Username: String,
  (required)
  Password: String,
  (required)
  Email: String,
  (required)
  Birthday: Date
}*/
app.put('/users/:Username', [ //comment: see if GitHub Desktop is responding (20210810)
      check('Username', 'Username is required').isLength({min: 5}),
      check('Username', 'Username contains non alphanumeric characters' +
      ' - not allowed.').isAlphanumeric(),
      check('Email', 'Email does not appear to be valid').isEmail()
    ], (req, res) => {
      Users.findOneAndUpdate({ Username: req.params.Username }, { $set:
    {
      Username: req.body.Username,
      Password: req.body.Password,
      Email: req.body.Email,
      Birthday: req.body.Birthday
    }
  },
  { new: true }, // This line makes sure that the updated document is returned
  (err, updatedUser) => {
    if(err) {
      console.error(err);
      res.status(500).send('Error: ' + err);
    } else {
      res.json(updatedUser);
    }
  });
});

// Add a movie to a user's list of favorites
app.post('/users/:Username/movies/:MovieID', passport.authenticate('jwt', 
		{ session: false }), (req, res) => {
  Users.findOneAndUpdate({ Username: req.params.Username }, {
     $push: { FavoriteMovies: req.params.MovieID }
   },
   { new: true }, // This line makes sure that the updated document is returned
  (err, updatedUser) => {
    if (err) {
      console.error(err);
      res.status(500).send('Error: ' + err);
    } else {
      res.json(updatedUser);
    }
  });
});

// Delete a movie from a user's list of favorites
app.delete('/users/:Username/movies/:MovieID', passport.authenticate('jwt', 
		{ session: false }), (req, res) => {
  console.log(req.params);
  Users.findOneAndUpdate({ Username:  req.params.Username }, {
    $pull: { FavoriteMovies: req.params.MovieID }
  }, { new: true})
  .then((user) => {
    if (!user) {
      res.status(400).send(req.params.Username + ' was not found');
    } else {
      //res.status(200).send(req.params.Username + ' was deleted.');
      res.json(user);
    }
  })
  .catch((err) => {
    console.error(err);
    res.status(500).send('Error: ' + err);
  })
});

// Delete a user by username
app.delete('/users/:Username', [
  check('Username', 'Username is required').isLength({min: 5}),
  check('Username', 'Username contains non alphanumeric characters' +
  ' - not allowed.').isAlphanumeric(),
  check('Email', 'Email does not appear to be valid').isEmail()
], (req, res) => {
  Users.findOneAndRemove({ Username: req.params.Username })
    .then((user) => {
      if (!user) {
        res.status(400).send(req.params.Username + ' was not found');
      } else {
        res.status(200).send(req.params.Username + ' was deleted.');
      }
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send('Error: ' + err);
    });
});

const port = process.env.PORT || 8080;
app.listen(port, '0.0.0.0',() => {
 console.log('Listening on Port ' + port);
});
