var Mplayer = require('mplayer');
var fs = require('fs');
var path = require('path');
var URL = require('url');
var _ = require('lodash');
var mime = require("mime");
var parseArgs = require('minimist');
var http = require('http');
var io = require('socket.io');
var songs = require('./lib/songs');

var app,io,mplayer;
function init(){
  process.env.PATH+=';'+path.resolve('mplayer');
  app = http.createServer(service);
  io = io(app);
  mplayer = new Mplayer();

  app.listen(parseArgs.p || 8888, function(){
    console.log('http://localhost:'+app.address().port);
  });
}

init();


var API = {
  '/search': function(req,res){

  }
}

function service (req, res){
  var location = URL.parse(req.url);
  var fileContent;
  if(location.pathname == '/'){
    location.pathname = 'index.html';
  }

  if(API[location.pathname]){
    API.search.handel(req,res);
    return;
  }

  var filePath = path.join(__dirname, 'client', location.pathname);
  fs.readFile(filePath,function(err, data){
    if(err){
      res.writeHead(500, {'Content-Type': mime.lookup(filePath)});
      return res.end('error: '+filePath);
    }
    res.writeHead(200, {'Content-Type': mime.lookup(filePath)});
    res.end(data);
  });
}

var playerOptions = {
  volume: 40,
  time:0,
  totalTime:0
}

io.on('connection', function (socket) {
  socket.emit('login');
  socket.on('reqSongsSuggest',function(keyword){
    songs.getSongs(keyword).then(function(res){
      socket.emit('resSongsSuggest',res);
    });
  });
  socket.on('playSongs',function(id){
    songs.getSongsUrl(id).then(function(res){
      var url = res.data[0].url;
      console.log('play: '+url);
      playerOptions.time = 0;
      playerOptions.totalTime = 0;
      mplayer.stop();
      setTimeout(function(){
        mplayer.openFile(url);
      },500);
      //mplayer.volume(60);
    });
  });
  mplayer.on('start',function(){
    this.volume(playerOptions.volume);
    socket.emit('startPlay',[playerOptions.time,playerOptions.totalTime])
  });
  mplayer.player.instance.stdout.on('data',function(data){
    data = data.toString();
    if(data.indexOf('A:') === 0) {
      times = data.match(/A\:\s+(\d+\.\d+).*?of\s(\d+\.\d+)/);
      playerOptions.time = parseInt(times[1]);
      playerOptions.totalTime = parseInt(times[2]);
      socket.broadcast.emit('timechange',[playerOptions.time,playerOptions.totalTime]);
    }
  });
  mplayer.player.getStatus();
  socket.on('volume',function(percent){
    playerOptions.volume = percent;
    mplayer.volume(playerOptions.volume);
    socket.broadcast.emit('volume',playerOptions.volume);
  });
  socket.on('pause',function(){
    mplayer.pause();
  });
  socket.on('play',function(){
    mplayer.play();
  });
  socket.on('seek',function(min){
    mplayer.seek(min);
    mplayer.volume(playerOptions.volume);
  });
  socket.on('seekPercent',function(percent){
    mplayer.seekPercent(percent);
    mplayer.volume(playerOptions.volume);
  });
  console.log(socket.id);
  socket._id = socket.id.substring(2)
});



/*
var musics = fs.readdirSync('./music').toString().split(',');
var mplayer = new Mplayer();
mplayer.on('stop',play);
function play(){
  var current = _.sample(musics);
  console.log('play: '+current);
  mplayer.player.cmd('loadfile', ['"./music/' + current + '"']);
  mplayer.volume(60);
}
play();*/

