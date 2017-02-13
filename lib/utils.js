var request = require('request')
var $ = require('cheerio')


module.exports = {
	spider: function(){
		return new Promise(function(res,rej){
			request(options,function(err,res,body){
				if(err){
					reject(err);
				}else{
					switch(type){
						case 'json':
							body = JSON.parse(body);
							break;
						case 'html':
							body = $.load(body);
							break;
					}
					resolve(body);
				}
			});
		});
	}(options, type) => {
		return new Promise((resolve, reject) => {
			request(options, function (err, res, body) {
				if (err) {
					reject(err)
				}else {
					switch (type) {
						case 'json':
							body = JSON.parse(body);
							break
						case 'jq':
							body = $.load(body);
							break
					}
					resolve(body)
				}
			})
		})
	},
	spiderStream: (options) => {
		return request(options)
	},
	Crypto: require('./Crypto'),

	suffix2Type: function (suffix) {
		return {
			css: 'text/css',
			html: 'text/html',
			js: 'application/javascript',
			mp4: 'video/mp4'
		}[suffix] || 'text/plain'
	},
	songs: require('./songs')
}