var express           =     require('express')
  , passport          =     require('passport')
  , util              =     require('util')
  , FacebookStrategy  =     require('@passport-next/passport-facebook').Strategy
  , session           =     require('express-session')
  , cookieParser      =     require('cookie-parser')
  , bodyParser        =     require('body-parser')
  , config            =     require('./config/config')
  , mysql             =     require('promise-mysql')
  , app               =     express();

//Define MySQL parameter in Config.js file.


var pool = mysql.createPool({
  host     : config.host,
  user     : config.username,
  password : config.password,
  database : config.database,
  connectionLimit: 10
});
//Connect to Database only if Config.js parameter is set.

if(config.use_database==='true')
{
    .connect();
}

// Passport session setup.
passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});


// Use the FacebookStrategy within Passport.

passport.use(new FacebookStrategy({
    clientID: config.facebook_api_key,
    clientSecret:config.facebook_api_secret ,
    callbackURL: config.callback_url,
	graphApiVersion: 'v3.1'
  },
  function(accessToken, refreshToken, profile, done) {
    process.nextTick(function () {
      //Check whether the User exists or not using profile.id
      if(config.use_database==='true')
      {

		  pool.getConnection().then(function(connection){
				connection.query("SELECT * from Fb_User where fb_id="+profile.id,function(err,rows,fields){
				if(err) throw err;
				if(rows.length===0)
				  {
					console.log("There is no such user, adding now");
					console.log("Profile id: " + profile.id );
					connection.query("INSERT into Fb_User(fb_id) VALUES('" + String(profile.id) + "')");
				  }
				  else
					{
					  console.log("User already exists in database");
					}
				  });
		  }).catch(function(err) {
			done(err);
		});		  
		  

		  

      }
      return done(null, profile);
    });
  }
));


app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({secret: 'keyboard cat', key: 'sid', resave: true, saveUninitialized: true}));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(__dirname + '/public'));

app.get('/', function(req, res){
  res.render('index', { user: req.user });
});

app.get('/friend', function(req, res){
  res.render('friend', { user: req.user });
});

app.get('/account', ensureAuthenticated, function(req, res){
  res.render('account', { user: req.user });
});

app.get('/auth/facebook', passport.authenticate('facebook',{scope:['email', 'public_profile', 'user_gender', 'user_birthday', 'user_likes']}));

app.get('/auth/facebook/callback',
  passport.authenticate('facebook', { successRedirect : '/', failureRedirect: '/' }),
  function(req, res) {
    res.redirect('/');
  });

app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});


function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/')
}

app.listen(5006, () => {
  console.log('Server is up on port 5006');
});
