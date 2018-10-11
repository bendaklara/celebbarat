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
//console.log(access_token);


//setting up mysql connection
var pool = mysql.createPool({
  host     : config.host,
  user     : config.username,
  password : config.password,
  database : config.database,
  connectionLimit: 10
});

function fbrequest(user, token, requeststring) {
	return new Promise(function(resolve, reject) {
	var success = '0';
	var generic_error_message='Generic error message'; // Ezt kapja, ha nem azonosítottuk a hiba okát.
	var errormessage=generic_error_message; 
	
	graph
	.setAccessToken(token)
	.setOptions(options)
	.get(requeststring , function(err, fbresponse) {
		//console.log('Raw Fb response: ' + JSON.stringify(fbresponse));
		
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
				resolve({'user': user, 'fbresponse': fbresponse}); //This is the meat of the application
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
			var user = {'token': accessToken,
						'id'   : profile.id,
						'displayName'   : profile.displayName,
						'first_name': 'NULL',					
						'last_name': 'NULL',						
						'middle_name': 'NULL',						
						'gender': 'NULL',
						'email'   : 'NULL',
						'birthday': 'NULL',
						'celeb_fb_id': 'NULL',
						'celeb_fbLink': 'NULL',
						};			
			fbrequest(user, accessToken, profile.id +'?fields=id,name,gender,email,birthday,first_name,last_name,middle_name,likes{id}').then(function(response,user) {
					//console.log('Ez most a komplex response.');
					//console.log(response);
					//console.log("Visszakaptam a FB response-t.");			
					user=response['user'];
					//console.log(user);
					response=response['fbresponse'];
					//console.log(response);					
					var year,month,day,birthday,likes;
					user.first_name=response.first_name;
					user.last_name=response.last_name;
					
					if(response.birthday){
						month=(response.birthday).slice(0,2);
						day=(response.birthday).slice(3,5);						
						year=(response.birthday).slice(6);
						birthday=year+"-"+month+"-"+day;
						user.birthday=birthday;
					}	
					if(response.middle_name){
						user.middle_name=response.middle_name;
					}
					if(response.gender){
						user.gender=response.gender;
					}	
					if(response.email){
						user.email=response.email;
					}
					//console.log("User feltoltve.");
					//console.log(user);
					
					if(response.likes.data){
						likes=response.likes.data;
					}
					var likeList='';
					var likeInsertQuery="INSERT IGNORE INTO Page_Likes (user_fb_id, page_fb_id) VALUES ('";
					
					for(var i in likes)
					{
						 likeList= likeList+likes[i].id + ', ';
						 likeInsertQuery=likeInsertQuery+user.id + "', '" + likes[i].id + "'), ('";
					}					
					//console.log("LikeInsertQuery:");
					//console.log(likeInsertQuery.slice(0,likeInsertQuery.length-4));
					//console.log("LikeList:");
					//console.log(likeList.slice(0,likeList.length-2));
					
					pool.getConnection().then(function(connection){
						connection.query("SELECT * from Fb_User where fb_id="+user.id,function(err,rows,fields){
							if(err) throw err;
							if(rows.length===0)
								{
								console.log("There is no such user, adding now");
								
								var userInsertQuery="INSERT into Fb_User(fb_id,first_name,last_name,middle_name,email,gender,birthday) VALUES('" + String(user.id) + "', '" + String(user.first_name) + "', '" + String(user.last_name) + "', '" + String(user.middle_name) + "', '" + String(user.email) + "', '" + String(user.gender) + "', '" + String(user.birthday) + "')";
								
								connection.query(userInsertQuery);
							
							} else {
								console.log("User already exists in database");
								
								var userUpdateQuery="UPDATE Fb_User SET first_name='" + String(user.first_name) + "', last_name='" + String(user.last_name) + "', middle_name='" + String(user.middle_name) + "', email='" + String(user.email) + "', gender= '" + String(user.gender) + "', birthday= '" + String(user.birthday) + "' WHERE fb_id LIKE '" + String(user.id) + "'";
								
								connection.query(userUpdateQuery);
								
								
								  
							}
						});
						connection.release();				  
					}).catch(function(err) {
					console.log(err);
					});

					pool.getConnection().then(function(connection){
						connection.query(likeInsertQuery.slice(0,likeInsertQuery.length-4));						
						connection.release();
					}).catch(function(err) {
						console.log(err);
					});						
					
					pool.getConnection().then(function(connection){
						var genderBinary=2;
						var selectYourCelebQuery='';
						if(user.gender=='female'){
							genderBinary=1;
						}
						else if(user.gender=='male'){
							genderBinary=0;
						}
						var selectCelebQuery="SELECT facebook_id FROM Celeb WHERE facebook_id IN ("+likeList.slice(0,likeList.length-2)+")";
						connection.query(selectCelebQuery).then(function(rows){
							if(rows[0]===undefined){
								if(genderBinary==2){
									selectYourCelebQuery="SELECT facebook_id FROM Celeb ORDER BY ABS( DATEDIFF('" +user.birthday+ "', birthdate) ) LIMIT 1";
								}
								else{
									selectYourCelebQuery="SELECT facebook_id FROM Celeb WHERE gender='" + String(genderBinary) + "' ORDER BY ABS( DATEDIFF('" +String(user.birthday)+ "', birthdate) ) LIMIT 1";
								}
							}
							else{
								var likesUnion="('"
								for(var i in rows)
								{
									 likesUnion= likesUnion+rows[i].facebook_id + "', '";
								}
								if(genderBinary==2){
									selectYourCelebQuery="SELECT facebook_id FROM Celeb WHERE facebook_id IN " + String(likesUnion.slice(0,likesUnion.length-3)) + ") ORDER BY ABS( DATEDIFF('" +String(user.birthday)+ "', birthdate) ) LIMIT 1";
								}
								else{
									selectYourCelebQuery="SELECT facebook_id FROM Celeb WHERE gender='" + String(genderBinary)+ "' AND facebook_id IN " + String(likesUnion.slice(0,likesUnion.length-3)) + ") ORDER BY ABS( DATEDIFF('" +String(user.birthday)+ "', birthdate) ) LIMIT 1";
								}
								
							}
							connection.query(selectYourCelebQuery).then(function(rows){
								var sqlCelebUpdate="INSERT IGNORE INTO User_Celeb (user_fb_id, celeb_fb_id) VALUES ('"+ String(user.id)+ "', '"+ String(rows[0].facebook_id) +"')";
								connection.query(sqlCelebUpdate);
							});
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
			
		//console.log(user);
		//Itt lehet hozzáadni a Userhez a kedvenc celebet, és annak adatait, lekéréssel.
		
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
	pool.getConnection().then(function(connection){
		var facebookLink='';
		var getUserCelebQuery="SELECT celeb_fb_id FROM User_Celeb WHERE user_fb_id="+String(req.user.id);
		connection.query(getUserCelebQuery).then(function(rows){
			req.user.celeb_fb_id=rows[0].celeb_fb_id;
			facebookLink="https://facebook.com/" + rows[0].celeb_fb_id;
			console.log(facebookLink);
			req.user.fbLink=facebookLink;
			console.log("Req User updated");	
			console.log(user)
			res.render('index', { user: req.user });
		});						
		connection.release();
	}).catch(function(err) {
		console.log(err);
	});	  
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
