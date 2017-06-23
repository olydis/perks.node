task 'fix-line-endings', 'typescript', ->
  typescriptFiles()
    .pipe eol {eolc: 'LF', encoding:'utf8'}
    .pipe destination 'src'

task 'clean' , 'typescript', (done)->
  typescriptProjectFolders()
    .pipe foreach (each,next)->
      rmdir "#{each.path}/dist/" , ->
        next null

task 'nuke' , '',['clean'], (done)->
  typescriptProjectFolders()
    .pipe foreach (each,next)->
      rmdir "#{each.path}/node_modules/" , ->
        next null

task 'test', 'typescript',['build/typescript'], (done)->
  typescriptProjectFolders()
    .pipe where (each) ->
      return test "-d", "#{each.path}/test"

    .pipe foreach (each,next)->
      execute "#{basefolder}/node_modules/.bin/npm test", {cwd: each.path, silent:false }, (code,stdout,stderr) ->
        next null

task "compile/typescript", '' , (done)->  
  done()

task 'build', 'typescript', (done)-> 
  typescriptProjectFolders()
    .on 'end', -> 
      run 'compile/typescript', done
      

    .pipe foreach (each,next ) ->
      fn = filename each.path
      deps =  ("compile/typescript/#{d.substring(d.indexOf('/')+1)}" for d in (global.dependencies[fn] || []) )
      task 'compile/typescript', fn,deps, (fin) ->
        execute "#{basefolder}/node_modules/.bin/tsc --project #{each.path} ", {cwd: each.path }, (code,stdout,stderr) ->
          if watch 
            execute "#{basefolder}/node_modules/.bin/tsc --watch --project #{each.path}", (c,o,e)-> 
             echo "watching #{fn}"
            , (d) -> echo d.replace(/^src\//mig, "#{basefolder}/src/")
          fin()
      next null
    return null

task 'npm-install', '', ['init-deps'], (done)-> 
  global.threshold =1
  typescriptProjectFolders()
    .on 'end', -> 
      run 'npm-install', ->
        done()
     
    .pipe foreach (each,next ) ->
      fn = filename each.path
      deps =  ("npm-install/#{d.substring(d.indexOf('/')+1)}" for d in (global.dependencies[fn] || []) )
      
      task 'npm-install', fn,deps, (fin) ->
        echo "Running npm install for #{each.path}."
        execute "#{basefolder}/node_modules/.bin/npm install", {cwd: each.path, silent:false }, (code,stdout,stderr) ->
          echo stderr
          echo stdout
          fin()

      next null
    return null

task 'publish', '', ['init-deps', 'build'], (done)-> 
  global.threshold =1
  typescriptProjectFolders()
    .on 'end', -> 
      run 'publish', ->
        done()
     
    .pipe foreach (each,next ) ->
      fn = filename each.path
      task 'publish', fn, (fin) ->
        echo "Running npm publish for #{each.path}."
        exec "#{basefolder}/node_modules/.bin/npm publish", {cwd: each.path, silent:true }, (code,stdout,stderr) ->
          echo stdout
          if( code )
            if( stderr.indexOf "previously" > -1 )
              echo warning "Project #{chalk.green(fn)} wasn't published - it's already published at that version."
            else 
              echo error "Project #{fn} wasn't published - #{stderr}"
          fin()

      next null
    return null    