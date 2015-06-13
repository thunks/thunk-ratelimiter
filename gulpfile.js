'use strict'

var gulp = require('gulp')
var gulpSequence = require('gulp-sequence')
var mocha = require('gulp-mocha')

gulp.task('mocha', function () {
  return gulp.src('test/*.js', {read: false})
    .pipe(mocha({timeout: 10000}))
})

gulp.task('exit', function (callback) {
  callback()
  process.exit(0)
})

gulp.task('default', ['test'])

gulp.task('test', gulpSequence('mocha', 'exit'))
