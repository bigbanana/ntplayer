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
var EventEmitter = require('events').EventEmitter.prototype;

var app,io,mplayer;
function init(){
  process.env.PATH+=';'+path.resolve('mplayer');
  app = http.createServer(service);
  io = io(app);
  
  playerOptions.init();
  mplayer = new Mplayer();

  app.listen(parseArgs.p || 8888, function(){
    console.log('http://localhost:'+app.address().port);
  });
}



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

var playerOptions = _.extend({
  volume: 50,
  time:0,
  totalTime:0,
  songs:null,
  songsList:[],
  setVolume: function(percent,socket){
    percent = parseInt(percent);
    if(isNaN(percent)) return;
    if(this.volume != percent){
      this.volume = percent;
      this.emit('volumeChange',socket);
    }
  },
  setTime:function(time){
    time = parseInt(time);
    if(isNaN(time)) return;
    if(this.time != time){
      this.time = time;
      this.emit('timeChange');
    }
  },
  setTotalTime: function(time){
    time = parseInt(time);
    if(isNaN(time)) return;
    if(this.totalTime != time){
      this.totalTime = time;
      this.emit('totalTimeChange');
    }
  },
  setSongs: function(songs){
    this.songs = songs;
    this.emit('songsChange');
  },
  addSongsList: function(songs){
    this.songsList = this.songsList.concat(songs);
    this.emit('songsListChange');
    this._writeSongsList();
  },
  _writeSongsList: function(){
    if(!fs.existsSync('cache')){
      fs.mkdirSync('cache');
    }
    fs.writeFileSync("cache/playlist.json",JSON.stringify(this.songsList));
  },
  _readSongsList: function(){
    if(!fs.existsSync('cache')){
      fs.mkdirSync('cache');
    }
    if(!fs.existsSync('cache/playlist.json')){
      return [];
    }else{
      return JSON.parse(fs.readFileSync('cache/playlist.json'));
    }
  },
  getSongsIndex: function(item){
    return this.songsList.indexOf(item || this.songs);
  },
  prevSongs: function(){
    var songsList = this.songsList;
    var index = this.getSongsIndex(this.songs);
    index -= 1;
    index = index < 0 ? songsList.length-1 : index;
    return songsList[index];
  },
  nextSongs: function(){
    var songsList = this.songsList;
    var index = this.getSongsIndex(this.songs);
    index += 1;
    index = index > songsList.length-1 ? 0 : index;
    return songsList[index];
  },
  init: function(){
    this.addSongsList(this._readSongsList());
  }
},EventEmitter);

function initSocket(){
  io.on('connection', function (socket) {
    socket.emit('login');
    socket.emit('volume',playerOptions.volume);
    if(playerOptions.songs){
      io.emit('init',playerOptions);
    }
    socket.on('reqSongsSuggest',function(keyword){
      songs.getSongs(keyword).then(function(res){
        socket.emit('resSongsSuggest',res);
      });
    });
    socket.on('playSongs',function(item){
      playSongs(item);
    });
    socket.on('addSongs',function(item){
      playerOptions.addSongsList(item);
      if(!playerOptions.songs){
        playSongs(playerOptions.songsList[0]);
      }
    });
    socket.on('nextSongs',function(){
      playSongs(playerOptions.nextSongs());
    });
    socket.on('prevSongs',function(){
      playSongs(playerOptions.prevSongs());
    });
    socket.on('volume',function(percent){
      playerOptions.setVolume(percent,socket);
      mplayer.volume(playerOptions.volume);
    });
    socket.on('songsPause',function(){
      mplayer.pause();
    });
    socket.on('songsPlay',function(){
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
  });

  mplayer.on('start',function(){
    this.volume(playerOptions.volume);
    io.emit('startPlay',{
      time:0,
      totalTime:0,
      index:playerOptions.getSongsIndex(),
      songs:playerOptions.songs
    });
  });
  mplayer.on('sstop',function(code){
    //自动播放完成
    if(code == 1){
      playSongs(playerOptions.nextSongs());
    }
  });
  mplayer.player.instance.stdout.on('data',function(data){
    data = data.toString();
    if(data.indexOf('A:') === 0) {
      times = data.match(/A\:\s+(\d+\.\d+).*?of\s(\d+\.\d+)/);
      playerOptions.setTime(times[1]);
      playerOptions.setTotalTime(times[2]);
      io.emit('timechange',[playerOptions.time,playerOptions.totalTime]);
    }
    if(data.indexOf('EOF code:') != -1){
      var code = data.match(/EOF\scode\:\s(\d+)/);
      code = code && code[1];
      code = parseInt(code) || 1;
      mplayer.emit('sstop',code);
    }
  });

  playerOptions.on('volumeChange',function(socket){
    socket.broadcast.emit('volume',playerOptions.volume);
  });
  playerOptions.on('songsListChange',function(){
    io.emit('menuChange',playerOptions.songsList);
  });

  if(playerOptions.songsList.length>0){
    playSongs(playerOptions.songsList[0]);
  }

  function playSongs(item){
    if(!item) return;
    songs.getSongsUrl(item.id).then(function(res){
      playerOptions.setTime(0);
      playerOptions.setTotalTime(0);
      playerOptions.setSongs(item);
      var url = res.data[0].url;
      //console.log(url);
      mplayer.stop();
      setTimeout(function(){
        mplayer.openFile(url);
      },500);
    });
  }

}

init();
initSocket();


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

