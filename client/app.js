(function(){
  var $player,$mainbox,$actions,$controls;
  $player = $("#player");
  $mainbox = $player.find(".main-box");
  $controls = $player.find(".controls");
  $actions = $mainbox.find(".actions");
  window.socket = io();
  socket.on('login',function(data){
    console.log('login')
  });

  function PlayStatus(){
    var status = {
      time: 0
    }
    _.extend(this,{
      setTime: function(time){
        time = parseInt(time);
        if(status.time != time){
          status.time = time;
          this.trigger('time',status.time);
        }
      },
      getTime: function(time){
        return status.time;
      }
    });
  }
  _.extend(PlayStatus.prototype,Backbone.Events);

  var playStatus = new PlayStatus();

  /* controls */
  +(function(){
    var serverTime,$seekAnimate;
    serverTime = 0;
    $seekAnimate = $({current:0});
    var $background,$name,$volume,$seek,$playControl,$play,$pause;

    $background = $player.find(".background");
    $name = $player.find(".name");
    $volume = $controls.find(".volume");
    $seek = $controls.find(".seek");
    $play = $controls.find(".icon-play");
    $pause = $controls.find(".icon-pause");
    $playControl = $controls.find(".play-controls");

    socket.on('init',setCurrent);
    socket.on('startPlay',setCurrent);
    socket.on('songsPause',stopSeek);
    socket.on('songsPlay',startSeek);
    socket.on('volume',function(percent){
      $volume.slider("value", percent )
    });
    socket.on('timeChange',timeChange);


    $volume.slider({
      range: "min",
      animate: true
    }).on('slide',function(event, ui){
      socket.emit('volume',ui.value);
    });

    $seek.slider({
      range: "min",
      step:0.01,
      disabled:true
    }).on('slide',function(event, ui){
      socket.emit('seekPercent',ui.value);
    });

    $playControl.on('click','.icon-skip-back',function(){
      socket.emit('prevSongs');
    }).on('click','.icon-play',function(){
      socket.emit('songsPlay');
    }).on('click','.icon-pause',function(){
      socket.emit('songsPause');
    }).on('click','.icon-skip-forward',function(){
      socket.emit('nextSongs');
    });

    function setCurrent(data){
      console.log(data);
      $background.attr('src', data.songs.al.picUrl);
      $name.text(data.songs.name+' - '+data.songs.ar[0].name);
      startSeek(data);
      timeChange(data);
    }

    function startSeek(data){
      $pause.toggle(data.playing);
      $play.toggle(!data.playing);
    }
    function stopSeek(data){
      $pause.toggle(data.playing);
      $play.toggle(!data.playing);
      $seekAnimate.stop(true);
    }

    function timeChange(data){
      serverTime = data.serverTime;
      var duration = (data.duration-data.time)*1000;
      $seekAnimate.stop(true);
      $seekAnimate[0].current = data.time;
      $seekAnimate.animate({current:data.duration},{
        duration: duration,
        easing: 'linear',
        step: function(current,opt){
          playStatus.setTime(current);
          $seek.find('.ui-slider-range').css("width",current*100/data.duration+'%');
        }
      });
    }

  })();

  /* panel */
  +(function(){
    $(document).on('click','.panel .close-panel',function(){
      $(this).closest('.panel').animate({top:'-100%'},200);
      $actions.fadeIn(200);
    });
    $actions.on('click','>a',function(){
      $actions.fadeOut(200);
    });
  })();

  /* songs-list */
  +(function(){
    var songsList = [];
    var $songsListSwitch = $mainbox.find('.icon-menu');
    var $songsList = $mainbox.find('.songs-list');
    var $list = $songsList.find('.list');
    var $search = $songsList.find('.search');

    socket.on('init',function(data){
      songsList = data.songsList;
      $list.html(listTemp({list:data.songsList}));
    });

    socket.on('menuChange',function(list){
      songsList = list;
      $list.html(listTemp({list:list}));
    });

    $songsListSwitch.on('click',function(){
      $songsList.animate({top:0},200);
    });
    $list.on('click','.name',function(){
      var index = $(this).parent().index();
      socket.emit('playSongs',songsList[index]);
    });
    $list.on('click','.icon-cross',function(){
      var index = $(this).parent().index();
      socket.emit('delSongs',songsList[index]);
    });

    var listTemp = _.template([
      '<% _.each(list,function(item){ %>',
        '<div class="item">',
          '<div class="name"><%= item.name %> - <%= item.ar[0].name %></div>',
          '<a class="icon-cross"></a>',
        '</div>',
      '<% }) %>'
    ].join(''));

  })();

  /* songs-search */
  +(function(){
    var songsList = [];
    var $songsSearchSwitch = $mainbox.find('.icon-search');
    var $songsSearch = $mainbox.find('.songs-search');
    var $list = $songsSearch.find('.list');
    var $search = $songsSearch.find('.search input');

    socket.on('resSongsSuggest',function(data){
      var list = data.result.songs || [];
      list = list.map(function(item){
        return {
          label: item.name+' - '+item.ar[0].name,
          value: item
        };
      });
      $search.data('uiAutocomplete').__response(list);
    });

    $search.autocomplete({
      autoFocus: true,
      source: function(term,callback){
        socket.emit('reqSongsSuggest',term);
      }
    }).on('autocompleteselect',function(event, ui){
      socket.emit('addSongs',ui.item.value);
      socket.emit('playSongs',ui.item.value);
      return false;
    }).on('focus',function(){
      $(this).autocomplete('search');
    });

    $songsSearchSwitch.on('click',function(){
      $songsSearch.animate({top:0},200);
    });

    $list.on('click','.item',function(){
      var index = $(this).index();
      socket.emit('playSongs',songsList[index]);
    });

    var listTemp = _.template([
      '<% _.each(list,function(item){ %>',
        '<div class="item"><%= item.name %> - <%= item.ar[0].name %></div>',
      '<% }) %>'
    ].join(''));

  })();

  /* songs-lyric */
  +(function(){
    var lyrics = {},lyricsKeys = [],lyricsValues = [],lyricsOpt;
    var $background = $player.find(".background");
    var $songsLyric = $mainbox.find('.songs-lyric');
    var $content = $songsLyric.find('.content');
    var $closePanel = $songsLyric.find('.close-panel');
    lyricsOpt = {
      ar: '演唱者',
      by: '歌词作者',
      ti: '歌曲'
    }

    socket.on('init',setLyric);
    socket.on('startPlay',setLyric);
    
    $background.on('click',function(){
      $songsLyric.css({top:0,opacity:0}).animate({opacity:1},200);
      $actions.fadeOut(200);
    });
    $songsLyric.on('click',function(){
      $songsLyric.animate({opacity:0},200,function(){
        $songsLyric.css({top:'-100%'});
      });
      $actions.fadeIn(200);
    });

    playStatus.on('time',function(time){
      if(lyrics[time]){
        showLyric(lyrics[time]);
      }
    });

    function setLyric(data){
      if(data.lyric.nolyric){
        $content.html('暂无歌词');
      }else{
        lyrics = {},lyricsKeys = [],lyricsValues = [];
        _.each(data.lyric.lrc.lyric.split('\n'),function(item){
          var test;
          var info = item.match(/^\[(.*?)\](.*)/);
          if(!info){
            //console.log('无法解析歌词');
          }else if(test = info[1].match(/(\d+)\:(\d+)/)){
            var key = parseInt(test[1])*60+parseInt(test[2]);
            var value = info[2];
            if(!info[2]) return;

            lyricsKeys.push(key);
            lyricsValues.push(value);
            lyrics[key] = lyricsValues.length-1;
          }else if(test = info[1].match(/(\w+)\:(.*)/)){
            var pre = lyricsOpt[test[1]];
            pre = pre ? pre + ' : ' : '';
            var key = 0;
            var value = pre + test[2];

            lyricsKeys.push(key);
            lyricsValues.push(value);
            lyrics[key] = lyricsValues.length-1;
          }else{
            console.log('无法解析歌词');
          }
        })
        $content.html(lyricTemp({lyrics:lyricsValues}));
      }
      var index = _.sortedIndex(lyricsKeys,playStatus.getTime())-1;
      index = index<0 ? 0 : index;
      showLyric(index);
    }

    function showLyric(num){
      var offset,duration;
      duration = 0.2
      if(num>6){
        offset = (num-6)*24;
      }else{
        offset = 0;
      }

      $content.stop(true).animate({scrollTop:offset},duration*1000);
      $content.children().eq(num).addClass('current')
        .siblings().removeClass('current');
    }

    var lyricTemp = _.template([
      '<% _.each(lyrics,function(item){ %>',
        '<div class="item">',
          '<div class="text"><%= item.replace(/\\[.*?\\]/g,"") %></div>',
        '</div>',
      '<% }) %>'
    ].join(''));

  })();

})();
