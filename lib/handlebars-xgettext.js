/**
 * handlebars-xgettext
 * Extract translatable strings from Handlebars templates.
 */

var fs = require('fs'),
  path = require('path'),
  readdirp = require('readdirp'),
  _ = require('underscore'),
  Parser = require('./parser'),
  Gettext = require('node-gettext');

/**
 * Parse input for  save the i18n strings to a PO file.
 *
 * @param {Array} files (optional)
 * @param {Object} options (optional)
 * @param {Function(Buffer)} callback (optional)
 */
function parse(files, options, callback) {
  if (!files && !options.directory && !options['files-from']) {
    throw 'No input specified';
  }

  if (typeof files === 'string') {
    files = [files];
  }

  options = _.extend({
    'from-code': 'utf8',
    'force-po': false
  }, options);

  var gt = new Gettext(),
    gtDomain = null,
    gtContext = false,
    po;

  gt.addTextdomain(gtDomain);

  function parseFiles (files) {
    var parser = new Parser(options.keyword),
      strings = {},
      template,
      relativePath,
      sentences = {};

    function concat (memo, lines, file) {
      lines.forEach(function (line) {
        memo.push(file + ':' + line);
      });
      return memo;
    }

    files.forEach(function (file) {
      template = fs.readFileSync(path.resolve(file), options['from-code']);
      relativePath = file.split(path.sep).join('/');

      _.each(parser.parse(template), function (obj, str) {
        var line = obj['lines'] || [];
        strings[str] = strings[str] || {};
        strings[str][relativePath] = (strings[str][relativePath] || []).concat(line);

        // take the array of sentences with the greatest length (most singular/plural forms)
        if (!sentences[str] || sentences[str].length < obj.sentences.length){
          sentences[str] = obj.sentences;
        }
      });
    });

    _.each(strings, function(obj, str) {
      // do the dictionary lookup
      var sentence_ar = sentences[str]; 
      // one or two clean translations depending on whether it is plural or not
      var ar = sentence_ar.length <= 1 ? [null] : [null, null]; 
      // set the translation with the GetText library
      gt.setTranslation(gtDomain, gtContext, sentence_ar, ar);
      // set the comment to indicate all the lines the sentence appears on
      gt.setComment(gtDomain, gtContext, str, {code: _.reduce(obj, concat, []).join('\n')});
    });
  }

  function output () {
    if (callback) {
      if (Object.keys(gt.listKeys(gtDomain)).length > 0 || options['force-po']) {
        po = gt.compilePO();

        if (options.output) {
          fs.writeFileSync(options.output, po);
        }
      }
      callback(po);
    }
  }

  if (options.directory) {
    readdirp({root: options.directory}, function(err, res) {
      if (err) {
        throw err;
      }

      parseFiles(res.files.map(function (file) {
        return file.fullPath;
      }));

      output();
    });
  } else {
    if (files) {
      parseFiles(files);
    }
    output();
  }
}

module.exports = parse;
