const $ = require('jquery');
const react = require('react');
const rd = require('react-dom');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('issues.db');
const moment = require('moment')
const e = react.createElement;

var details;
var page = 1;
var pagesize = 10;
var count = 0;
var issues = [];
var sort = "ORDER BY updated DESC";
var httpPage = 1;
var responseLength = 0;
var currentLength = -1;

$(document).ready(function() {

  //defines the custom scrollbar
  $(function() {
  	$("#main").overlayScrollbars({
      className: "os-theme-dark",
      scrollbars : {
        visibility       : "auto",
        autoHide         : "scroll",
        autoHideDelay    : 500,
        dragScrolling    : true,
        clickScrolling   : true,
        touchSupport     : true,
        snapHandle       : false
      },
    });
  });

  //creates database if it doesn't exist, and gets the total count if it does exist
  db.serialize(function() {
    db.run("CREATE TABLE IF NOT EXISTS issues (id TEXT PRIMARY KEY, title TEXT, state TEXT, owner TEXT, img TEXT, created TEXT, updated TEXT, body TEXT)");
    db.all("SELECT COUNT(*) FROM issues AS count", function(err, row) {
      count = row[0]["COUNT(*)"];
      getPage();
    });
  });

  //makes an http request with the given user input from the form element
  $("form").submit(function(event) {
    event.preventDefault();
    httpPage = 1;
    org = $("#organization").val();
    rep = $("#repo").val();
    //removes previous data that is in the database, then inserts new data
    db.run("DELETE FROM issues", function() {
      count = 0;
      //start newRequest
      $("progress").css('display', 'block'); // display loadingbar
      HttpRequest(org, rep);
      document.getElementById("form").reset();
      $("form").hide();
      $("#newRequest").show();
    });
  });

  //next page
  $("#next").click(function() {
    page++;
    getPage();
  });

  //previous page
  $("#prev").click(function() {
    page--;
    getPage();
  });

  //shows the hidden form field when the new request button is clicked
  $("#newRequest").click(function() {
    $("form").show();
    $("#newRequest").hide();
  });

  //hides the detailed view when an area outside of the detail card is clicked
  $("#overlay").click(function() {
    hideOverlay();
  })

  //detects changes in the sorting dropdown menu and updates the page accordingly
  $("#sorting").on("change", function() {
    if (this.value == "owner") {
      sort = "ORDER BY LOWER(owner) ASC";
    } else {
      sort = "ORDER BY updated DESC";
    }
    getPage();
  })

  //shows the detailed view when an issue is clicked
  $(document).on("click", "#result .issue", function() {
    $("#overlay").show();
    $("#overlayCard").show();
    renderOverlay($(this).find(".idSpan").text());
  });

  //hides the detailed view when the X button of the card is clicked
  $(document).on("click", "#cancel", function() {
    hideOverlay();
  });

  //hides the detailed view after pressing ESC
  $(document).keyup(function(e) {
    if (e.key === "Escape") { // escape key maps to keycode `27`
      hideOverlay();
    }
  });
});

//connects to a url and parses the resulting HTML response as a JSON
var HttpClient = function() {
    this.get = function(url, callback) {
        var req = new XMLHttpRequest();
        req.onreadystatechange = function() {
            if (req.readyState == 4 && req.status == 200)
                callback(JSON.parse(req.responseText));
        }

        req.open("GET", url, true);
        req.send(null);
    }
}

//uses the JSON response from the GET request to add elements to the SQLite database and updates the page with the new information
function HttpRequest(org, rep) {
  var client = new HttpClient();

  client.get('https://api.github.com/repos/' + org + '/' + rep + '/issues?per_page=100&page=' + httpPage, function(response) {
    currentLength = response.length;
    responseLength += response.length;
    console.log(response.length)
    response.forEach(function(element, index) {
      count++;
      var stmt = db.prepare("INSERT INTO issues VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
      stmt.run(element.id, element.title, element.state, element.user.login, element.user.avatar_url, element.created_at, element.updated_at, element.body);
      stmt.finalize();
    });

    httpPage++;
    if (response.length == 100) {
      HttpRequest(org, rep);
    } else {
      //request complete
      getPage();
    }
    page = 1;
  });
}

//used to exit the detailed view
function hideOverlay() {
  $("#overlay").hide();
  $("#overlayCard").hide();
}

//displays the issues that should go on the current page given the pagesize (default 10)
function getPage() {
  db.all("SELECT * FROM issues " + sort + " LIMIT ? OFFSET ?", pagesize, (page - 1) * pagesize, function(err, rows) {
    var total = Math.ceil(count / pagesize);
    issues = [];
    rows.forEach(function(element) {
      issues.push(e(Issue, {title: element.title, key: element.id, state: element.state, id: element.id}, null));
    });

    $("progress").css('display', 'none'); // hide loadingbar
    renderPage();

    //determines when to show/hide the next and previous buttons
    $("#prev").show();
    $("#next").show();
    if (page == 1) {
      $("#prev").hide();
    }
    if (page == total) {
      $("#next").hide();
    }
    $("#page").html("Page " + page + " of " + total);
  });
}

//displays the detailed issue card with the given id
function renderOverlay(id) {
  db.all("SELECT * FROM issues WHERE id == ? LIMIT 1", id, function(err, rows) {
    var element = rows[0];
    rd.render(
      e(Detail, {title: element.title, key: element.id, state: element.state, id: element.id, owner: element.owner, img: element.img, created: element.created, updated: element.updated, body: element.body}, null),
      document.getElementById("overlayCard")
    );
  });
}

//displays the current page
function renderPage() {
  rd.render(
    issues,
    document.getElementById("result")
  );
}

//React class that creates the main issue elements
class Issue extends react.Component {
  render() {
    return e('div', {className: 'issue'},
              e('h2', {className: 'title'}, `${this.props.title}`),
              e('div', {className: 'idDiv'},
                e('span', {className: 'textSpan'}, "Issue #"),
                e('span', {className: 'idSpan'},  `${this.props.id}`)
              ),
              e('h3', {className: 'state'}, `${this.props.state}`)
            );
  }
}

//React class that creates the detailed view of the issues
class Detail extends react.Component {
  render() {
    var c = moment(new Date(this.props.created)).format("MMM Do YYYY [at] HH:mm");
    var u = moment(new Date(this.props.updated)).format("MMM Do YYYY [at] HH:mm");

    return e('div', {className: 'detail'},
              e('h2', {className: 'title'}, `${this.props.title}`),
              e('h3', {className: 'state'}, `${this.props.state}`),
              e('div', {className: 'idDiv'},
                e('span', {className: 'textSpan'}, "Issue #"),
                e('span', {className: 'idSpan'},  `${this.props.id}`)
              ),
              e('h3', {className: 'owner'}, `${this.props.owner}`),
              e('img', {id: 'avatar', src: `${this.props.img}`}, null),
              e('p', {className: 'created'}, "Created on " + c.toString()),
              e('p', {className: 'updated'}, "Last updated on " + u.toString()),
              e('p', {className: 'body'}, `${this.props.body}`),
              e('input', {id: 'cancel', type: 'button', value: '🗙'}, null)
            );
  }
}
