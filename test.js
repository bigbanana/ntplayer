var Mplayer = require('mplayer');
var fs = require('fs');
var path = require('path');
var _ = require('lodash');


function init(){
  process.env.PATH+=';'+path.resolve('mplayer');
}
init();

var musics = fs.readdirSync('./music').toString().split(',');
var mplayer = new Mplayer();
mplayer.on('stop',play);
function play(){
  var current = _.sample(musics);
  console.log('play: '+current);
  mplayer.player.cmd('loadfile', ['"./music/' + current + '"']);
  mplayer.volume(60);
}
play();

