function fbcelebrequest(token, requeststring) {
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
				var picUrl;
				if(response.data.url){
					picUrl=response.data.url;
				resolve(picUrl); //This is the meat of the application
				} else {
					errormessage='Thrown error'
					reject(errormessage);
					
				}
			}	
		});	
  });
}



fbrequest(accessToken, profile.id +'/picture')
	.then(function(response) {
		user.celeb_pic=response;
	}, function(error) {
		console.log('Visszakaptam a fbrequest error response-t');		
		console.log(error);	
	}
);