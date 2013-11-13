/**
 * WordNet SQLite DB exporter
 *
 * @author Dariusz Dziuk <me@dariuszdziuk.com>
 */

var async = require('async');
var wordnet = require('wordnet');
var sqlite3 = require('sqlite3').verbose();
var fs = require('fs');
var winston = require('winston');

/**
 * Logger
 */

winston.loggers.add('info', {
  console: {
    level: 'info',
    colorize: 'true',
    label: 'info'
  }
});

var logger = winston.loggers.get('info');

/**
 * Execute import
 */

async.waterfall([
  listWords,
  createDatabase,
  insertWords
],
function(err, result) {

  /* Handle error */
  if (err) {
    console.log('An error occured: %s', err);
    return;
  }

  console.log('Database created.');

});

/**
 * Lists the WordNet words
 *
 * @param {Function} callback Std callback with list of words.
 */

function listWords(callback) {

  wordnet.list(callback);

};

/**
 * Creates a SQLite DataBase
 *
 * @param {Array} words List of words.
 * @param {Function} callback Std callback with db and list of words.
 */

function createDatabase(words, callback) {

  logger.info('loaded words', words.length);

  var db = new sqlite3.Database(
    'db.sqlite',
    sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
    function(err) {

      /* Handle error */
      if (err) {
        callback(err);
        return;
      }

      /* Create the DB */
      var query = fs.readFileSync('sql/create.sql', 'utf-8');
      db.run(query, function(err) {

        /* Handle error */
        if (err) {
          logger.error('error creating database', err);
          callback(err);
          return;
        }

        logger.info('database created');
        callback(null, words, db);

      });

    }
  );

};

/**
 * Insert word query
 *
 * @type {String}
 */

var _insertWordSQL = fs.readFileSync('sql/insert.sql', 'utf-8');

/**
 * Inserts a single word into the DB
 *
 * @param {Object} db Instance of SQLite3 DB.
 * @param {Object} word Word to add (word, alternatives, glossary, pos).
 * @param {Function} callback Std callback with error.
 */

function insertWord(db, word, callback) {

  db.run(_insertWordSQL, {
    $word: word.word,
    $pos: word.pos,
    $words: word.alternatives,
    $glossary: word.glossary
  }, function(err) {

    /* Handle error */
    if (err) {
      console.err('error adding word %s', word, err);
      callback(err);
      return;
    }

    logger.info('word added: %s (%s)', word.word, word.alternatives);

    callback();

  });

};

/**
 * Inserts words into the DB
 *
 * @param {Array} words List of words.
 * @param {Object} db Instance of SQLite database.
 */

function insertWords(words, db, callback) {

  var concurrency = 1;

  /* Workers queue */
  var queue = async.queue(function(word, callback) {

    /* Look up the word */
    wordnet.lookup(word, function(err, definitions) {

      /* Handle error */
      if (err) {
        logger.error('word not found: %s', word);
        callback(err);
        return;
      }

      /* Parse definitons */
      async.each(definitions, function(definition, callback) {

        var meanings = [];
        definition.meta.words.forEach(function(word) {
          meanings.push(word.word);
        });

        var word = meanings.shift();
        var alternatives = meanings.join('|');
        var glossary = definition.glossary;
        var pos = definition.meta.synsetType;

        insertWord(db, {
          word: word,
          pos: pos,
          alternatives: alternatives,
          glossary: glossary
        }, callback);

      }, callback); // defintions.forEach

    }); // wordnet.lookUp

  }, concurrency);

  /* On queue finish */
  queue.drain = function() {

    winston.info('import complete');
    callback();

  };

  /* Enqueue words */
  words.forEach(function(word) {
    queue.push(word);
  });

};