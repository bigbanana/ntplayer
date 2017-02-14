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
      console.log(percent)
      $volume.slider("value", percent )
    });

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
      $background.attr('src', data.songs.al.picUrl);
      $name.text(data.songs.name+' - '+data.songs.ar[0].name);
      startSeek(data);
    }

    function startSeek(data){
      $pause.toggle(data.playing);
      $play.toggle(!data.playing);
      serverTime = data.serverTime;
      var duration = (data.totalTime-data.time)*1000;
      $seekAnimate.stop(true);
      $seekAnimate[0].current = data.time;
      $seekAnimate.animate({current:data.totalTime},{
        duration: duration,
        step: function(current){
          $seek.find('.ui-slider-range').css("width",current*100/data.totalTime+'%');
        }
      });
    }
    function stopSeek(data){
      $pause.toggle(data.playing);
      $play.toggle(!data.playing);
      $seekAnimate.stop(true);
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

  console.log('查询歌曲');
  console.log('reqSongsSuggest \'$keyword\'');
  console.log('播放歌曲');
  console.log('playSongs $id');
  console.log('调节音量');
  console.log('volume $percent');
  console.log('暂停');
  console.log('pause');
  console.log('播放');
  console.log('play');
  console.log('跳转到');
  console.log('seek $num');
  console.log('跳转到百分比');
  console.log('seekPercent $percent');

})();
