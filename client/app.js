(function(){
  var $player,$volume,$seek,$playControl,$mainbox,$actions;
  $player = $("#player");
  $volume = $player.find(".volume");
  $seek = $player.find(".seek");
  $playControl = $player.find(".play-controls");
  $mainbox = $player.find(".main-box");
  $actions = $mainbox.find(".actions");
  window.socket = io();
  socket.on('login',function(data){
    console.log('login')
  });
  socket.on('volume',function(percent){
    $volume.slider("value", percent )
  });
  socket.on('timechange',function(pars){
    $seek.slider("value", pars[0]*100/pars[1] )
  });

  $volume.slider({
    range: "min",
    animate: true
  }).on('slide',function(event, ui){
    socket.emit('volume',ui.value);
  });

  $seek.slider({
    range: "min",
    animate: true,
    disabled:true
  }).on('slide',function(event, ui){
    socket.emit('seekPercent',ui.value);
  });
  
  

  $playControl.on('click','.icon-skip-back',function(){
    socket.emit('prevSongs');
  }).on('click','.icon-play',function(){
    $(this).hide().next().show();
    socket.emit('songsPlay');
  }).on('click','.icon-pause',function(){
    $(this).hide().prev().show();
    socket.emit('songsPause');
  }).on('click','.icon-skip-forward',function(){
    socket.emit('nextSongs');
  });

  /* current play */
  +(function(){
    var $background,$name;
    $background = $player.find(".background");
    $name = $player.find(".name");

    socket.on('init',setCurrent);
    socket.on('startPlay',setCurrent);

    function setCurrent(data){
      $background.attr('src', data.songs.al.picUrl);
      $name.text(data.songs.name+' - '+data.songs.ar[0].name);
    }
  })();

  /* panel */
  +(function(){
    $(document).on('click','.panel .icon-cross',function(){
      $(this).closest('.panel').animate({top:'-100%'},200);
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
