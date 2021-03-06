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
       .pipe where (each ) -> 
          return test "-f", "#{each.path}/tsconfig.json"
        
  typescriptFiles: () -> 
    typescriptProjectFolders()
      .pipe foreach (each,next,more)=>
        source(["#{each.path}/**/*.ts", "#{each.path}/**/*.json", "!#{each.path}/node_modules/**","!#{each.path}/dist/**"])
        .on 'end', -> 
            next null
        .pipe foreach (e,n)->
            e.base = each.base
            more.push e
            n null

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


task 'init-list', '', (done)-> 
  typescriptProjectFolders()
    .pipe foreach (each,next)->
      echo each.path
      next null

global.projects = {}
global.dependencies = {}

# ensures directories for sibling projects are symlinked in place and creates map of dependencies.
task 'init-deps', '', (done)->
  
  typescriptProjectFolders()
    .on 'end', -> 
      # we've loaded their project.json files.
      # find dependencies
      for p of global.projects 
        project = global.projects[p]

        # make sure the project has a node_modules folder
        mkdir "-p", "#{basefolder}/src/#{project.name}/node_modules" if !test "-d", "#{basefolder}/src/#{project.name}/node_modules"

        for dep of project.json.dependencies
          if global.projects[dep] # the dependency is local to this solution
            global.dependencies[project.name].push( dep )
            # symlink sibling projects
            mklink "#{basefolder}/src/#{project.name}/node_modules/#{dep}", global.projects[dep].folder            
      done()

    .pipe foreach (each,next) -> 
      prjson= require "#{each.path}/package.json"  
      fullname=prjson.name
      global.dependencies[basename each.path] = []
      global.projects[ fullname ] = {
        name: basename each.path
        fullname: fullname
        folder: each.path
        json: prjson
        orig: JSON.stringify(prjson,null,2)
        version: prjson.version
        dependencies: []
      }
  return null

updateVersions = () ->
  again = true
  
  while( again ) 
    again = false 
    for p of global.projects 
      project = global.projects[p]
      for dep of project.json.dependencies
        if global.projects[dep]
          if not (project.json.dependencies[dep] == "^#{global.projects[dep].version}") 
            again = true
            # if this file has been hit, don't rev the version again.
            if (!project.hit ) 
              project.json.version = project.json.version.replace(/(.*)\.(.*)/, (a,b,c) -> "#{b}.#{ 1+Number(c) }" )
              project.version = project.json.version
              project.hit = true

            project.json.dependencies[dep] = "^#{global.projects[dep].version}"
            text = JSON.stringify( project.json , null, 2)
            echo "Updating #{project.name} reference to  #{dep}"
            text.to("#{project.folder}/package.json" )  

task 'update-dependencies', 'Updates dependency information in package.json files.',['init-deps'], ()-> 
  # First, let's mark every project that 
  updateVersions()
