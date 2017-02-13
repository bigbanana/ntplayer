var request = require('request');
var _ = require('lodash');
var crypto = require('./crypto');

var defaultOptions = {
  headers:{
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/55.0.2883.87 Safari/537.36'
  }
}

var API = {
  getSongs: 'http://music.163.com/weapi/cloudsearch/get/web?csrf_token=',
  getSongsUrl: 'http://music.163.com/weapi/song/enhance/player/url?csrf_token='
}

function getJSON(options){
  options = _.extend({},defaultOptions,options);
  options.headers['User-Agent'] = defaultOptions.headers['User-Agent'];
  return new Promise(function(resolve,reject){
    request(options,function(err,res,body){
      if(err){
        reject(err);
      }else{
        resolve(JSON.parse(body));
      }
    });
  });
}

function getLyric(id){
  return getJSON({
    url: `http://music.163.com/weapi/song/lyric?csrf_token=`,
    method: 'POST',
    form: crypto.aesRsaEncrypt( JSON.stringify({id: id, os:'osx', lv: -1, kv: -1, tv: 1}))
  }).then(function(res){
    if(x.code == 200 && !x.nolyric){
      return {
        code: 200,
        lrc: x.lrc.lyric
      }
    }
    return {
      code: 500
    }
  });

}

function getSongs(keyword){
  return getJSON({
    url: API.getSongs,
    method: 'POST',
    headers: {
      'Referer': 'http://music.163.com/search/'
    },
    form: crypto.aesRsaEncrypt( JSON.stringify({s: keyword, type: '1'}))
  }).then(function(res){
    return res
  })
}

function getSongsUrl(id){
  return getJSON({
    url: API.getSongsUrl,
    method: 'POST',
    headers: {
      'Referer': 'http://music.163.com/search/'
    },
    form: crypto.aesRsaEncrypt( JSON.stringify({ids: [id], br: 128000}))
  }).then(function(res){
    return res
  })
}

function getSongsSuggest(keyword) {
    return getJSON({
        url: "http://music.163.com/weapi/search/suggest/web?csrf_token=",
        method: 'POST',
        headers: {
          Referer: 'http://music.163.com/search/'
        },
        form: crypto.aesRsaEncrypt(JSON.stringify({s: keyword}))
    }, 'json').then(function(res){
      return res;
    })
}

module.exports = {
  getLyric:getLyric,
  getSongs:getSongs,
  getSongsUrl:getSongsUrl,
  getSongsSuggest:getSongsSuggest
}