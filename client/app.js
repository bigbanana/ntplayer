(function(){
  var $volume,$seek,$keyword;
  window.socket = io();
  socket.on('login',function(data){
    console.log(arguments)
  });
  socket.on('volume',function(percent){
    $volume.slider("value", percent )
  });
  socket.on('timechange',function(pars){
    $seek.slider("value", pars[0]*100/pars[1] )
  });
  socket.on('startPlay',function(pars){
    console.log(pars);
  });

  $volume = $("#volume");
  $volume.slider({min:0,max:100}).on('slide',function(event, ui){
    socket.emit('volume',ui.value);
  });

  $seek = $("#seek");
  $seek.slider({min:0,max:100,disabled:true}).on('slide',function(event, ui){
    socket.emit('seekPercent',ui.value);
  });

  $keyword = $("#keyword");
  $keyword.autocomplete({
    autoFocus: true,
    source: function(term,callback){
      socket.emit('reqSongsSuggest',term);
    }
  }).on('autocompleteselect',function(event, ui){
    socket.emit('playSongs',ui.item.value);
    return false;
  }).on('focus',function(){
    $(this).autocomplete('search');
  });

  socket.on('resSongsSuggest',function(data){
    var list = data.result.songs.map(function(item){
      return {
        label: item.name+' - '+item.ar[0].name,
        value: item.id
      };
    });
    $("#keyword").data('uiAutocomplete').__response(list);
  });

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
