
(function(){
  var deferred=null,installed=false;
  var display=window.matchMedia('(display-mode: standalone)'),minimal=window.matchMedia('(display-mode: minimal-ui)');
  function sync(){var b=document.getElementById('addyInstall');if(b)b.hidden=installed||navigator.standalone===true||display.matches||minimal.matches;}
  window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();deferred=e;sync();});
  window.addEventListener('appinstalled',function(){installed=true;deferred=null;sync();});
  [display,minimal].forEach(function(m){if(m.addEventListener)m.addEventListener('change',sync);else if(m.addListener)m.addListener(sync);});
  document.addEventListener('DOMContentLoaded',function(){
    var b=document.getElementById('addyInstall'),d=document.getElementById('addyInstallDialog');
    var ua=navigator.userAgent||'',ios=/iPad|iPhone|iPod/i.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1),android=/Android/i.test(ua),mac=/Macintosh/i.test(ua)&&!ios;
    var steps=ios?['Open this page in Safari if you are using an in-app browser.','Tap Share (the square with an upward arrow).','Choose Add to Home Screen. You may need to scroll or tap More.','If shown, turn on Open as Web App, then tap Add.']:android?['Open this page in Chrome.','Tap the three-dot browser menu.','Choose Add to home screen or Install app, then confirm.']:mac?['In Safari, choose File > Add to Dock.','In Chrome or Edge, use the install icon in the address bar or the browser menu to install this site as an app.']:['Open this page in Chrome or Microsoft Edge.','Look for the install icon in the address bar, or open the three-dot menu.','In Chrome, look under Cast, save, and share > Install page as app. In Edge, choose Apps > Install this site as an app.','Confirm the installation. Find ADDY BUY Beta in your apps or Start menu.'];
    var list=document.getElementById('addyInstallSteps');steps.forEach(function(t){var li=document.createElement('li');li.textContent=t;list.appendChild(li);});
    function guide(){if(d.showModal){if(!d.open)d.showModal();}else alert(steps.join('\n'));}
    b.addEventListener('click',async function(){
      if(!deferred){guide();return;}
      var event=deferred;deferred=null;b.disabled=true;
      try{await event.prompt();var choice=await event.userChoice;if(choice&&choice.outcome==='accepted'){installed=true;sync();}}
      catch(e){guide();}
      finally{b.disabled=false;}
    });
    document.getElementById('addyInstallClose').addEventListener('click',function(){d.close();});
    sync();
  });
})();
