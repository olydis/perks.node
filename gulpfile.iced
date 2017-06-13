# set the base folder of this project
global.basefolder = "#{__dirname}"

# use our tweaked version of gulp with iced coffee.
require './.gulp/gulp.iced'
semver = require 'semver'

# tasks required for this build 
Tasks "typescript"  # compiling typescript

# Settings
Import
  initialized: false

  typescriptProjectFolders: ()->
    source ["./src/*" ]
    # source ['src/polyfill', 'src/console', 'src/unpack', 'src/dotnet-install']

  typescriptProjects: () -> 
    typescriptProjectFolders()
      .pipe foreach (each,next,more)=>
        source "#{each.path}/tsconfig.json"
          .on 'end', -> 
            next null
          .pipe foreach (e,n)->
            more.push e
            n null
  
  generatedFiles: () -> 
    typescriptProjectFolders()
      .pipe foreach (each,next,more)=>
        source(["#{each.path}/**/*.js","#{each.path}/**/*.d.ts" ,"#{each.path}/**/*.js.map", "!**/node_modules/**","!src/polyfill/*-*.js"])
          .on 'end', -> 
            next null
          .pipe foreach (e,n)->
            more.push e
            n null
        
  typescriptFiles: () -> 
    typescriptProjectFolders()
      .pipe foreach (each,next,more)=>
        source(["#{each.path}/**/*.ts", "#{each.path}/**/*.json", "!#{each.path}/node_modules/**"])
        .on 'end', -> 
            next null
        .pipe foreach (e,n)->
            e.base = each.base
            more.push e
            n null

  Dependencies:
    "dotnet-install" : ['@microsoft.azure/console', '@microsoft.azure/polyfill', '@microsoft.azure/unpack', '@microsoft.azure/eventing', "@microsoft.azure/async-io"]
    "console" : [ '@microsoft.azure/polyfill' ]
    "unpack" : [ '@microsoft.azure/polyfill' ]
    "eventing" : [ '@microsoft.azure/polyfill' ]
    "async-io" : [ '@microsoft.azure/polyfill' ]
    "extension" : [ '@microsoft.azure/polyfill' , "dotnet-install" , "@microsoft.azure/async-io", '@microsoft.azure/eventing']

task 'init-deps', '',(done)->
  for each of Dependencies 
    mkdir "-p", "#{basefolder}/src/#{each}/node_modules" if !test "-d", "#{basefolder}/src/#{each}/node_modules"
    for item in Dependencies[each]
      mkdir "-p", "#{basefolder}/src/#{each}/node_modules/@microsoft.azure" if !test "-d", "#{basefolder}/src/#{each}/node_modules/@microsoft.azure"
      i = item.substring item.indexOf('/')+1

      if test "-d" ,"#{basefolder}/src/#{i}" 
        mklink "#{basefolder}/src/#{each}/node_modules/#{item}" , "#{basefolder}/src/#{i}" 
  done()

task 'init',"",[ "init-deps" ], (done)->
  Fail "YOU MUST HAVE NODEJS VERSION GREATER THAN 6.9.5" if semver.lt( process.versions.node , "6.9.5" )
  
  return done() if initialized
  global.initialized = true
  # if the node_modules isn't created, do it.
  if fileExists "#{basefolder}/package-lock.json" 
    doit = true if (newer "#{basefolder}/package.json",  "#{basefolder}/package-lock.json") 
  else 
    doit = true if (newer "#{basefolder}/package.json",  "#{basefolder}/node_modules") 
  
  typescriptProjectFolders()
    .on 'end', -> 
      if doit || force
          echo warning "\n#{ info 'NOTE:' } 'node_modules' may be out of date - running 'npm install' for you.\n"
          exec "npm install", {cwd:basefolder,silent:true},(c,o,e)->
            done null
      else 
        done null

    .pipe foreach (each,next) -> 
      # is any of the TS projects node_modules out of date?
      #if isV5
      #  doit = true if (! test "-d", "#{each.path}/node_modules") or (newer "#{each.path}/package.json",  "#{each.path}/package-lock.json")
      #else 

      # we are forcing npm4 for actual projects because npm5 is frustrating still.
      if (! test "-d", "#{each.path}/node_modules") or (newer "#{each.path}/package.json",  "#{each.path}/node_modules")
        echo "node_modules in #{each.path} may be out of date."
        doit = true

      next null

  return null
return null
