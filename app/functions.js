const $ = require('jquery');
const react = require('react');
const rd = require('react-dom');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('goals.db');
const e = react.createElement;

const issues = [];
const details = [];
var page;
const pagesize = 10;

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

$(document).ready(function() {
  $("form").submit(function(event) {
    event.preventDefault();
    var org = $("#organization").val();
    var rep = $("#repo").val();

    //https://api.github.com/repos/walmartlabs/thorax/issues
    var client = new HttpClient();
    client.get('https://api.github.com/repos/' + org + '/' + rep + '/issues', function(response) {
        response.forEach(function(element, index) {
          if (index % pagesize == 0) {
            issues.push([]);
            details.push([]);
          }
          issues[Math.floor(index / pagesize)].push(e(Issue, {title: element.title, key: element.id, state: element.state, id: element.id}, null));
          details[Math.floor(index / pagesize)].push(e(Detail, {title: element.title, key: element.id, state: element.state, id: element.id, owner: element.user.login, img: element.user.avatar_url, time: element.created_at, body: element.body}, null));
        });
        Object.freeze(issues);
        Object.freeze(details);
        page = 0;
        renderPage(page);
        getPage(page + 1, issues.length);
    });
  });


  $("#next").click(function() {
    renderPage(++page);
    getPage(page + 1, issues.length);
  });

  $("#prev").click(function() {
    renderPage(--page);
    getPage(page + 1, issues.length);
  });

  $(document).on("click", ".issue", function() {
    $("#overlay").show();
    renderOverlay($(this).index());
  });

  $(document).on("click", "#cancel", function() {
    $("#overlay").hide();
  });

  $(document).keyup(function(e) {
    if (e.key === "Escape") { // escape key maps to keycode `27`
      $("#overlay").hide();
    }
  });
});

function getPage(num, total) {
  $("#prev").show();
  $("#next").show();
  if (num == 1) {
    $("#prev").hide();
  }
  if (num == total) {
    $("#next").hide();
  }
  $("#page").html("Page " + num + " of " + total);
}

function renderOverlay(index) {
  rd.render(
    details[page][index % pagesize],
    document.getElementById("overlay")
  );
}

function renderPage(index) {
  rd.render(
    issues[index],
    document.getElementById("result")
  );
}

class Issue extends react.Component {
  render() {
    return e('div', {className: 'issue'},
              e('h2', {className: 'title'}, `${this.props.title}`),
              e('h3', {className: 'id'}, "Issue # "  + `${this.props.id}`),
              e('h3', {className: 'state'}, `${this.props.state}`)
            );
  }
}

class Detail extends react.Component {
  render() {
    return e('div', {className: 'detail'},
              e('h2', {className: 'title'}, `${this.props.title}`),
              e('h3', {className: 'id'}, `${this.props.id}`),
              e('h3', {className: 'state'}, `${this.props.state}`),
              e('h3', {className: 'owner'}, `${this.props.owner}`),
              e('img', {id: 'avatar', src: `${this.props.img}`}, null),
              e('h3', {className: 'time'}, `${this.props.time}`),
              e('p', {className: 'body'}, `${this.props.body}`),
              e('input', {id: 'cancel', type: 'button', value: 'X'}, null)
            );
  }
}

//sql
