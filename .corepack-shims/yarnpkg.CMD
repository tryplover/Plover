@SETLOCAL
@IF EXIST "%~dp0\node.exe" (
  "%~dp0\node.exe"  "%~dp0\..\..\..\..\..\..\..\Program Files\nodejs\node_modules\corepack\dist\yarnpkg.js" %*
) ELSE (
  @SET PATHEXT=%PATHEXT:;.JS;=;%
  node  "%~dp0\..\..\..\..\..\..\..\Program Files\nodejs\node_modules\corepack\dist\yarnpkg.js" %*
)
