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
  ops:{
    time:0,
    songs:null,
    lyric:null,
    songsList:[],
  },
  setTime:function(time){
    time = parseFloat(time);
    if(isNaN(time)) return;
    if(this.ops.time != time){
      this.ops.time = time;
      this.emit('timeChange',this.time);
    }
  },
  setTotalTime: function(time){
    time = parseFloat(time);
    if(isNaN(time)) return;
    if(this.ops.totalTime != time){
      this.ops.totalTime = time;
      this.emit('totalTimeChange',this.totalTime);
    }
  },
  setSongs: function(songs){
    this.ops.songs = songs;
    this.emit('songsChange');
  },
  setLyric: function(lyric){
    this.ops.lyric = lyric;
    this.emit('lyricChange');
  },
  addSongsList: function(songs){
    this.ops.songsList = this.ops.songsList.concat(songs);
    this.emit('songsListChange');
    this._writeSongsList();
  },
  delSongsList: function(songs){
    var index = this.getSongsIndex(songs);
    this.ops.songsList.splice(index,1);
    this.emit('songsListChange');
    this._writeSongsList();
  },
  _writeSongsList: function(){
    if(!fs.existsSync('cache')){
      fs.mkdirSync('cache');
    }
    fs.writeFileSync("cache/playlist.json",JSON.stringify(this.ops.songsList));
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
    if(!item) return 0;
    return this.ops.songsList.findIndex(function(it){
      return it.id == item.id;
    });
  },
  prevSongs: function(){
    var songsList = this.ops.songsList;
    var index = this.getSongsIndex(this.ops.songs);
    index -= 1;
    index = index < 0 ? songsList.length-1 : index;
    return songsList[index];
  },
  nextSongs: function(){
    var songsList = this.ops.songsList;
    var index = this.getSongsIndex(this.ops.songs);
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
    socket.emit('volume',mplayer.status.volume);
    if(mplayer.status.playing){
      socket.emit('init',_.extend({
        serverTime:new Date().getTime(),
      },playerOptions.ops,mplayer.status));
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
      if(!playerOptions.ops.songs){
        playSongs(playerOptions.ops.songsList[0]);
      }
    });
    socket.on('delSongs',function(item){
      playerOptions.delSongsList(item);
    });
    socket.on('nextSongs',function(){
      playSongs(playerOptions.nextSongs());
    });
    socket.on('prevSongs',function(){
      playSongs(playerOptions.prevSongs());
    });
    socket.on('volume',function(percent){
      mplayer.volume(percent);
      socket.broadcast.emit('volume',mplayer.status.volume);
    });
    socket.on('songsPause',function(){
      mplayer.pause();
    });
    socket.on('songsPlay',function(){
      mplayer.play();
    });
    socket.on('seek',function(min){
      mplayer.seek(min);
      mplayer.volume(mplayer.status.volume);
    });
    socket.on('seekPercent',function(percent){
      mplayer.seekPercent(percent);
      mplayer.volume(mplayer.status.volume);
    });
  });

  mplayer.openFile = function(file,options){
    var that = this;
    this.player.cmd('stop');
    this.setOptions(options);
    setTimeout(function(){
      that.player.cmd('loadfile', ['"' + file + '"']);
      that.status.playing = true;
    },100);
  }
  mplayer.on('time',function(time){
    playerOptions.ops.time = parseFloat(time);
    timeChange();
  });
  mplayer.on('play',function(){
    io.emit('songsPlay',_.extend({
      serverTime:new Date().getTime(),
    },playerOptions.ops,this.status));
  });
  mplayer.on('pause',function(){
    io.emit('songsPause',_.extend({
      serverTime:new Date().getTime(),
    },playerOptions.ops,this.status));
  });
  mplayer.on('start',function(){
    this.volume(this.status.volume);
    this.once('status',function(){
      io.emit('startPlay',_.extend({
        serverTime:new Date().getTime(),
      },playerOptions.ops,this.status));
    });
    
  });
  mplayer.player.on('playstop',function(code){
    //自动播放完成
    if(code == 1){
      playSongs(playerOptions.nextSongs());
    }
  });
  mplayer.player.instance.stdout.removeAllListeners('data');
  mplayer.player.instance.stdout.on('data',onData.bind(mplayer.player));

  playerOptions.on('songsListChange',function(){
    io.emit('menuChange',playerOptions.ops.songsList);
  });

  mplayer.volume(50);
  mplayer.setOptions({
    cache: 128,
    cacheMin: 1
  });
  if(playerOptions.ops.songsList.length>0){
    playSongs(playerOptions.ops.songsList[0]);
  }

  function playSongs(item){
    if(!item) return;
    Promise.all([songs.getSongsUrl(item.id),songs.getLyric(item.id)]).then(function(res){
      var songs,lyric;
      songs = res[0];
      lyric = res[1];
      playerOptions.setSongs(item);
      playerOptions.setLyric(lyric);
      var url = songs.data[0].url;
      mplayer.openFile(url);
    })
  }

  function onData(data){
    data = data.toString();

    if(this.options.debug) {
      if(data.indexOf('A:') !== 0){
        console.log('stdout: ' + data); 
      }
    }

    data = data.toString();

    if(data.indexOf('MPlayer') === 0) {
      this.emit('ready');
      this.setStatus(false);
    }

    if(data.indexOf('StreamTitle') !== -1) {
      this.setStatus({
        title: data.match(/StreamTitle='([^']*)'/)[1]
      });
    }

    if(data.indexOf('Playing ') !== -1) {
      var file = data.match(/Playing\s(.+?)\.\s/)[1];
      this.setStatus(false);
      this.setStatus({
        filename: file
      });
    }

    if(data.indexOf('Starting playback...') !== -1) {
      this.emit('playstart');
      this.getStatus();
    }

    if(data.indexOf('EOF code:') > -1) {
      var code = data.match(/EOF\scode\:\s(\d+)/);
      code = code && code[1];
      code = parseInt(code) || 1;
      this.emit('playstop',code);
      this.setStatus();
    }

    if(data.indexOf('A:') === 0) {
      var timeStart, timeEnd, time;

      if(data.indexOf(' V:') !== -1) {
        timeStart = data.indexOf(' V:') + 3;
        timeEnd = data.indexOf(' A-V:');
      } else {
        timeStart = data.indexOf('A:') + 2;
        timeEnd = data.indexOf(' (');
      }

      time = data.substring(timeStart, timeEnd).trim();
      this.emit('timechange', time)
    }

    if(data.indexOf('ANS_LENGTH') !== -1){
      this.setStatus({
        duration: parseFloat(data.match(/ANS_LENGTH=([0-9\.]*)/)[1])
      });
    }

  }

  timeChange = _.throttle(function(){
    io.emit('timeChange',_.extend({
      serverTime: new Date().getTime(),
      time: playerOptions.ops.time
    },mplayer.status));
  },10000,{leading:true});

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

