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
        source(["#{each.path}/**/*.js","#{each.path}/**/*.d.ts" ,"#{each.path}/**/*.js.map", "!**/node_modules/**","!src/perks.polyfill/*-*.js"])
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

Dependencies = 
  "dotnet-install" : ['perks.console', 'perks.polyfill', 'perks.unpack']
  "perks.console" : [ 'perks.polyfill' ]
  "perks.unpack" : [ 'perks.polyfill' ]


task 'init-deps', "", (done)-> 
  for each of Dependencies 
    mkdir "-p", "#{basefolder}/src/#{each}/node_modules/@microsoft.azure" if !test "-d", "#{basefolder}/src/#{each}/node_modules/@microsoft.azure"
    for item in Dependencies[each]
      mklink "#{basefolder}/src/#{each}/node_modules/@microsoft.azure/#{item}" , "#{basefolder}/src/#{item}"
  done()

task 'init', "", ["init-deps"] ,(done)->
  Fail "YOU MUST HAVE NODEJS VERSION GREATER THAN 6.9.5" if semver.lt( process.versions.node , "6.9.5" )

  execute "npm -v", (code,stdout,stderr) -> 
    isV5 = stdout.startsWith( "5" ) 
    
    return done() if initialized
    global.initialized = true
    # if the node_modules isn't created, do it.
    if isV5 
      doit = true if (newer "#{basefolder}/package.json",  "#{basefolder}/package-lock.json") 
    else 
      doit = true if (newer "#{basefolder}/package.json",  "#{basefolder}/node_modules") 

    typescriptProjectFolders()
      .on 'end', -> 
        if doit
          for pk of Dependencies 
            erase "#{pk}/package-lock.json"  if isV5
          
          echo warning "\n#{ info 'NOTE:' } 'node_modules' may be out of date - running 'npm install' for you.\n"
          exec "npm install",{silent:false},(c,o,e)->
            # after npm, hookup symlinks/junctions for dependent packages in projects
            echo warning "\n#{ info 'NOTE:' } it also seems prudent to do a 'gulp clean' at this point.\n"
            exec "gulp clean", (c,o,e) -> 
              done null
        else 
          done null

      .pipe foreach (each,next) -> 
        # is any of the TS projects node_modules out of date?
        if isV5
          doit = true if (! test "-d", "#{each.path}/node_modules") or (newer "#{each.path}/package.json",  "#{each.path}/package-lock.json")
          
        else 
          doit = true if (! test "-d", "#{each.path}/node_modules") or (newer "#{each.path}/package.json",  "#{each.path}/node_modules")
        
        next null
    return null
  return null