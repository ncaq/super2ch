(function(phantom, g, w) {

  w.super2ch = {
    forceRun: true
  };

  phantom.injectJs('../../super2ch.user.js');

  var _ = w.super2ch;

  _.test = {
    id: 0,

    print: function(source, result, expectedResult) {
      var id = ++_.test.id;
      if (result !== expectedResult) {
        g.console.error([
          'Test ' + id + ' failed.',
          '  Source:   ' + source,
          '  Result:   ' + result,
          '  Expected: ' + expectedResult
        ].join('\n'));
      } else {
        g.console.log('Test ' + id + ' OK');
      }
    },

    html: {
      head: function(tests) {
        tests.forEach(function(pair) {
          _.test.print(pair[0], _.Thread.modifyItemHeader(pair[0]), pair[1]);
        });
      },

      body: function(tests) {
        tests.forEach(function(pair) {
          _.test.print(pair[0], _.Thread.modifyItemHeader(pair[0]), pair[1]);
        });
      }
    }
  };

  (function(func) {
    func(g.require('fs'), 'tests', func);
  })(function(fs, dir, func) {

    fs.list(dir).sort().forEach(function(filename) {
      if (/^\.{1,2}$/.test(filename)) {
        return;
      }

      var path = dir + '/' + filename;
      if (fs.isDirectory(path)) {
        func(fs, path, func);
      }

      if (fs.isFile(path) && /\.js$/.test(filename)) {
        g.console.log('');
        g.console.log('Load: ' + path);
        phantom.injectJs(path);
      }
    });

  });

  phantom.exit();

})(this.phantom, this, this.window);
