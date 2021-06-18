(() => {
  const scriptName = 'bqs-main';
  const existingScript = document.getElementById(scriptName);
  
  if (existingScript) {
    existingScript.remove();
  }
  
  const scriptPath = browser.runtime.getURL(`${scriptName}.js`);
  const script = document.createElement('script');
  script.setAttribute('id', scriptName);
  script.src = scriptPath;
  document.body.appendChild(script);
})();