var express           =     require('express')
  , passport          =     require('passport')
  , util              =     require('util')
  , FacebookStrategy  =     require('@passport-next/passport-facebook').Strategy
  , session           =     require('express-session')
  , cookieParser      =     require('cookie-parser')
  , bodyParser        =     require('body-parser')
  , config            =     require('./config/config')
  , mysql             =     require('promise-mysql')
  , graph 			  =     require('fbgraph')
  , app               =     express();

//Define MySQL parameter in Config.js file.

//setting up fbgraph
var options = {
    timeout:  3000
  , pool:     { maxSockets:  Infinity }
  , headers:  { connection:  "keep-alive" }
};

const access_token=config.facebook_access_token;
console.log(access_token);


//setting up mysql connection
var pool = mysql.createPool({
  host     : config.host,
  user     : config.username,
  password : config.password,
  database : config.database,
  connectionLimit: 10
});

function fbrequest(token, requeststring) {
	return new Promise(function(resolve, reject) {
	var success = '0';
	var generic_error_message='Generic error message'; // Ezt kapja, ha nem azonosítottuk a hiba okát.
	var errormessage=generic_error_message; 
	
	graph
	.setAccessToken(token)
	.setOptions(options)
	.get(requeststring , function(err, fbresponse) {
		console.log('Raw Fb response: ' + JSON.stringify(fbresponse));
		
		// FB error handling
		if (fbresponse && fbresponse['error']) {
			// extract the error from the json
			console.log('Graph api error!!!!');
			var error=fbresponse['error'];
			if (error && error['code']) {
			// extract the error code
				var code=error['code'];
				console.log(code);
				//Let the message be appropriate to the error code
				switch (code) {
					case 10:
						errormessage='Error 10';
					break;

					case 803:
						errormessage='Error 803';
					break;

					case 190:
						errormessage='Error 109';
						break;

					default:
						//Generic error message. 
						//message='Ooops! There was an error. How about trying another page?';
						errormessage=generic_error_message ;
				}
			
			} else {
			errormessage=generic_error_message + ' No code in error message' ;
			}
			reject(errormessage);
		} 
		//End of FB error handling
		
		
		//Real functionality.
		else {if (fbresponse) {
				var message="success";
				resolve(fbresponse); //This is the meat of the application
				} else {
					errormessage='Thrown error'
					reject(errormessage);
					
				}
			}	
		});	
  });
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
			var user = {
				'id'   : profile.id,
				'displayName'   : profile.displayName,				
				'token': accessToken
			}
		
			fbrequest(accessToken, profile.id +'?fields=id,name,gender,email,birthday,first_name,last_name,middle_name,likes{id}').then(function(response) {
				console.log('Visszakaptam a fbrequest-tol a response-t');
				//console.log(response);
					var year,month,day;
					user = {
						'id'   : response.id,
						'displayName'   : response.name,
						'gender': response.gender,
						'first_name': response.first_name,					
						'last_name': response.last_name,						
						'middle_name': response.middle_name,						
						'email'   : response.email,
						'token': accessToken
					}
					if(response.birthday){
						day=(response.birthday).slice(0,2);
						month=(response.birthday).slice(3,5);						
					year=(response.birthday).slice(6);
						console.log("day " + day + " month " + month +" year " + year);
						}
				
					
					pool.getConnection().then(function(connection){
						connection.query("SELECT * from Fb_User where fb_id="+user.id,function(err,rows,fields){
						if(err) throw err;
						if(rows.length===0)
						  {
							console.log("There is no such user, adding now");
							var userInsertQuery="INSERT into Fb_User(fb_id,first_name,last_name,middle_name,email,gender) VALUES('" + String(user.id) + "', '" + String(user.first_name) + "', '" + String(user.last_name) + "', '" + String(user.middle_name) + "', '" + String(user.email) + "', '" + String(user.gender) + "')";
							connection.query(userInsertQuery);
						  }
						  else
							{
							  console.log("User already exists in database");
							}
						  });
						connection.release();				  
					}).catch(function(err) {
					console.log(err);
					});				
				
				
				
				}, function(error) {
				console.log('Visszakaptam a fbrequest error response-t');		
				console.log(response);
				
				}
			);
			
		  
			//console.log(profile);
      return done(null, user);
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
  console.log(req.user);
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
