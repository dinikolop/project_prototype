var progressVal = 0;
var parts = 0;
var all_maps;
//https://cors-anywhere.herokuapp.com/

var results = {}
var iter = 0
var loopCheckboxes = function(cb, df) {
  var maxcb = cb.length;
  customCheckboxes(cb[iter], df, maxcb, function() {
    iter++;
    if (iter < cb.length) {
      loopCheckboxes(cb, df);
    } else {
      iter = 0;
    }
  })
}

function meshCategories() {
  var categories = $('input[name^=meshcat]:checked');
  if(categories.length == 0){
    return "";
  }
  var ret = '(' + categories[0].value + ')';
  for(var i=1; i<categories.length; i++) {
    ret = '(' + ret + ' OR ' +  categories[i].value + ')';
  }
  return ret;
}

function customCheckboxes(cb, datefilter, maxcb, callback) {
  //var term = '(((("Health Care Category"[Mesh]) OR "Psychiatry and Psychology Category"[Mesh]) OR "Diseases Category"[Mesh]))' + datefilter
  var categories = meshCategories();
  if (cb.checked) {
    var search_terms = cb.value;
    var final_term = categories + datefilter + " AND " + search_terms;
    var inst_name = cb.nextSibling.data;
    console.log(final_term)
    searchPubMed(final_term, inst_name)
      .then(response => fetchResults(response, inst_name))
      .then(response => parseResults(response, inst_name))
      .then(response => displayResults(response, inst_name, maxcb));
  }

  callback();
}

function appendToMsgLog(msg) {
  $('#msg-log').append('<li class="list-group-item">' + msg + '</li>')
}

function updateProgress(msg) {
  progressVal += Math.ceil(100 / parts);
  val = Math.min(progressVal, 100);
  $('.progress-bar').attr('style', 'width:' + val + '%');
  $('.progress-bar').attr('aria-valuenow', val);
  $('.progress-bar').html(val + "%");
  appendToMsgLog(msg);
  if (val == 100) {
    $('#submit-button').prop('disabled', false);
    $('#submit-button').text('Submit');
  }
}

function searchPubMed(term, name) {
  $('#progr').show();
  $('#msgbox').show();
  var msg = "Searching PubMed for: <strong>" + name + "</strong>";
  appendToMsgLog(msg);
  return $.ajax({
    url: 'https://cors-anywhere.herokuapp.com/http://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi',
    data: {
      api_key: '71d0e0f6bacd1525701342ae331383e2b008',
      db: 'pubmed',
      dataType: 'json',
      usehistory: 'y',
      term: term,
      retmode: 'json',
      retmax: 0,
      sort: 'first+author'
    }
  });
}

function fetchResults(response, name) {
  var msg = "Received PMIDs for: <strong>" + name + "</strong>";
  updateProgress(msg);
  msg = "Fetching PMID data for: <strong>" + name + "</strong>";
  appendToMsgLog(msg);
  return $.ajax({
    url: 'https://cors-anywhere.herokuapp.com/http://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi',
    data: {
      api_key: '71d0e0f6bacd1525701342ae331383e2b008',
      db: 'pubmed',
      usehistory: 'y',
      webenv: response.esearchresult.webenv,
      query_key: response.esearchresult.querykey,
      retmode: 'xml',
      retmax: 10000
    }
  });
}

function parseResults(response, name) {
  var msg = "Fetched PMID data for: <strong>" + name + "</strong>";
  updateProgress(msg);
  var msg = "Parsing results for: <strong>" + name + "</strong>";
  appendToMsgLog(msg);
  var nodes = response.querySelectorAll('PubmedArticle');
  return $.map(nodes, function(node) {
    var pmidNode = node.querySelector('ArticleId[IdType="pubmed"]');
    var titleNode = node.querySelector('ArticleTitle');
    var doiNode = node.querySelector('ArticleId[IdType="doi"]');
    var pubdateNode = node.querySelector('PubDate');
    var abstractNode = node.querySelector('AbstractText');
    var authorNodes = node.querySelector('AuthorList[CompleteYN="Y"]');
    var meshNodes = node.querySelectorAll('MeshHeadingList > MeshHeading');
    var supplMeshNodes = node.querySelectorAll('SupplMeshList > SupplMeshName');
    var keywordNodes = node.querySelectorAll('KeywordList > Keyword');

    return {
      pmid: pmidNode ? pmidNode.textContent : null,
      title: titleNode ? titleNode.textContent : null,
      doi: doiNode ? doiNode.textContent : null,
      url: doiNode ? 'http://dx.doi.org/' + encodeURIComponent(doiNode.textContent) : 'http://pubmed.gov/' + pmidNode.textContent,
      abstract: abstractNode ? abstractNode.textContent : null,
      mesh: meshNodes ? $.map(meshNodes, function(meshNode) {
        var descriptorNode = meshNode.querySelector('DescriptorName');
        var qualifierNodes = meshNode.querySelectorAll('QualifierName');
        var ui = descriptorNode.getAttribute("UI");
        var major = descriptorNode.getAttribute("MajorTopicYN");
        var name = descriptorNode.textContent;
        var qualifiers = qualifierNodes ? $.map(qualifierNodes, function(qualifierNode) {
          var q_ui = qualifierNode.getAttribute("UI");
          var q_major = qualifierNode.getAttribute("MajorTopicYN");
          var q_name = qualifierNode.textContent;
          return {
            "q_major": q_major,
            "q_name": q_name,
            "q_ui": q_ui
          }
        }) : null;
        return {
          "major": major,
          "name": name,
          "qualifiers": qualifiers,
          "ui": ui,
        }
      }) : null,
      supplMesh: supplMeshNodes ? $.map(supplMeshNodes, function(supplMeshNode) {
        var s_ui = supplMeshNode.getAttribute("UI");
        var s_type = supplMeshNode.getAttribute("Type");
        var s_name = supplMeshNode.textContent;
        return {
          "s_name": s_name,
          "s_type": s_type,
          "s_ui": s_ui
        }
      }) : null,
      keywords: keywordNodes ? $.map(keywordNodes, function(keywordNode) {
        var k_major = keywordNode.getAttribute('MajorTopicYN');
        var k_keyword = keywordNode.textContent;
        return {
          "k_major": k_major,
          "k_keyword": k_keyword
        };
      }) : null
    };
  });

}

function displayResults(articles, name, maxcb) {
  var msg = "Finished: <strong>" + name + "</strong>";
  updateProgress(msg);
  results[name] = articles
  if (Object.keys(results).length == maxcb) {
    console.log(results);
    var i = 1;
    for (key in results) {
      createPMIDtable(key, results[key], i);
      i++;
    }
    $('#section2').show();
    $('#show-pmid-per-inst').show();
  }
}

function processPMID(data) {}

function format(name, data) {
  var div = $('<div/><table id="' + name + '">' +
    '<thead><tr>' +
    '<th>Mesh Code</th>' +
    '<th>Mesh Name</th>' +
    '<th>ICD10 Code</th>' +
    '<th>ICD10 Name</th>' +
    '</tr></thead>' +
    '<tbody></tbody>' +
    '</table></div>');
  return div
}

function createPMIDtable(institution, data, i) {
  console.log(institution)
  var sec = 'Section2' + i;
  var secTable = sec + '-table';
  var secTableBody = secTable + '-body';
  var toAppend = '<div id="' + sec + '" class="container-fluid" style="width=100%"> ' +
    '    <h1>PMIDs of ' + institution + '</h1> ' +
    '<div class="panel panel-default">' +
    '<div class="panel-body text-center">' +
    '<div class="row">' +
    '<div class="col-sm-4">' +
    '<div class="mini statistic">' +
    '<div class="value">2,204</div>' +
    '<div class="label">PMIDS with mappings</div>' +
    '</div><!-- /.statistic -->' +
    '</div><!-- /.col -->' +

    '<div class="col-sm-4">' +
    '<div class="tiny statistic">' +
    '<div class="value">2,204</div>' +
    '<div class="label">PMIDS without mappings</div>' +
    '</div><!-- /.statistic -->' +
    '</div><!-- /.col -->' +

    '<div class="col-sm-4">' +
    '<div class="small statistic">' +
    '<div class="value">2,204</div>' +
    '<div class="label">Distinct MeSH found</div>' +
    '</div><!-- /.statistic -->' +
    '</div><!-- /.col -->' +
    '</div>' +
    '</div> <!-- /.panel-body -->' +
    '</div><!-- /.panel -->' +
    '<table id="' + secTable + '" class="table table-striped table-responsive table-bordered" style="width=100%">' +
    '<thead><tr>' +
    '<th></th>' +
    '<th>PMID</th>' +
    '<th>Number of MeSH terms</th>' +
    '<th>Number of mappings</th>' +
    '</tr></thead>' +
    '<tfoot><tr>' +
    '<th></th>' +
    '<th>PMID</th>' +
    '<th>Number of MeSH terms</th>' +
    '<th>Number of mappings</th>' +
    '</tr></tfoot>' +
    '<tbody id="' + secTableBody + '"></tbody>' +
    '</table>' +
    ' </div><hr>'
  $('#section2').append(toAppend);


  toAppend = '<li><a href="#' + sec + '">' + institution + '</a></li>'
  $('#dd-pmids').append(toAppend)
  $('#' + sec).css('padding-top', '50px');
  $('#' + sec).css('clear', 'both');

  var rows = [];
  for (var i = 0; i < data.length; i++) {
    var singlePMIDdict = data[i];
    var pmid = singlePMIDdict['pmid'];
    var title = singlePMIDdict['title'];
    var doi = singlePMIDdict['doi'];
    var allmesh = singlePMIDdict['mesh'];
    var supplMesh = singlePMIDdict['supplMesh'];

    var details = [];
    // var iCounter = 1;
    var totalmaps = 0;
    for (var j = 0; j < allmesh.length; j++) {
      var mesh = allmesh[j]["ui"];
      var meshname = all_maps[2][mesh];
      var icd10s = all_maps[0][mesh];
      if (!icd10s) {
        var detailrow = {
          "mesh code": mesh,
          "mesh name": "NA",
          "icd10 code": "NA",
          "icd10 name": "NA"
        };
        details.push(detailrow);
      } else {
        for (code in icd10s) {
          var icd10name = all_maps[3][code]
          totalmaps++;
          var detailrow = {
            "mesh code": mesh,
            "mesh name": meshname,
            "icd10 code": code,
            "icd10 name": icd10name
          };
          details.push(detailrow);
        }
      }

    }
    var row = {
      "pmid": pmid,
      "totalmesh": allmesh.length,
      "mappings": totalmaps,
      "details": details
    }

    rows.push(row);
  }
  console.log(rows)
  var oTable = $('#' + secTable).DataTable({
    "data": rows,
    "columns": [{
        className: 'details-control',
        orderable: false,
        data: null,
        defaultContent: '<img src="http://i.imgur.com/SD7Dz.png">'
      },
      {
        data: "pmid",
        "fnCreatedCell": function (nTd, sData, oData, iRow, iCol) {
          $(nTd).html('<a href="https://www.ncbi.nlm.nih.gov/pubmed/?term=' + oData.pmid + '" target="_blank">' + oData.pmid + '</a>');
        }
      },
      {
        data: "totalmesh"
      },
      {
        data: "mappings"
      }
    ],
    // order: [
    //   [1, "asc"]
    // ]
  })

  $('#' + secTable).css("width", "100%")

  $('#' + secTable + ' tbody').on('click', 'td.details-control', function() {
    var tr = $(this).closest('tr');
    var row = oTable.row(tr);
    var pmid = oTable.cell(this).data()["pmid"]
    if (row.child.isShown()) {
      this.children[0].src = "http://i.imgur.com/SD7Dz.png";
      row.child.hide();
      tr.removeClass('shown');
    } else {
      for (var k = 0; k < rows.length; k++) {
        if (rows[k]["pmid"] == pmid) {
          var detailsRowData = rows[k].details;
          break;
        }
      }
      var name = secTable + '-' + tr.index() + 'row';
      row.child(format(name, detailsRowData)).show();
      console.log(this.children[0])
      console.log(this.children[0].src)
      this.children[0].src = "http://i.imgur.com/d4ICC.png";
      row.child().find('#' + name).addClass("table table-striped table-responsive table-bordered")
      row.child().find('#' + name).DataTable({
        "data": detailsRowData,
        "columns": [{
            data: "mesh code",
            "fnCreatedCell": function (nTd, sData, oData, iRow, iCol) {
              $(nTd).html('<a href="https://meshb.nlm.nih.gov/record/ui?ui=' + oData['mesh code'] + '" target="_blank">' + oData['mesh code'] + '</a>');
            }
          },
          {
            data: "mesh name"
          },
          {
            data: "icd10 code"
          },
          {
            data: "icd10 name"
          }
        ],
        order: [
          [1, "asc"]
        ]
      });
      row.child().find('#' + name).css("width", "100%");
      tr.addClass('shown');
    }
  })
}




function createMapTable(maps, names) {
  var sorted = [];
  for (var key in names) {
    sorted[sorted.length] = key;
  }
  sorted.sort();
  for (var index = 0; index < sorted.length; index++) {
    key = sorted[index];
    for (var key2 in maps[key]) {
      var toAppend = "<tr> <td>" + key + "</td><td>" + names[key] + "</td><td>" + key2 + "</td><td>" + maps[key][key2] + "</td></tr>";
      $('#table-maps-body').append(toAppend);
    }
  }
  $('#table-maps').DataTable();
}

function processData(allText) {
  var allTextLines = allText.split(/\r\n|\n/);
  var headers = allTextLines[0].split('\t');
  var mesh2icd10 = {};
  var icd102mesh = {};
  var mesh_names = {};
  var icd10_names = {};

  for (var i = 1; i < allTextLines.length; i++) {

    var data = allTextLines[i].split('\t');
    if (data[0] == "") {
      continue;
    }
    mesh_names[data[0]] = data[1];
    icd10_names[data[2]] = data[3];

    if (!mesh2icd10[data[0]]) {
      mesh2icd10[data[0]] = {};
    }

    mesh2icd10[data[0]][data[2]] = data[3];


    //ICD10
    if (!icd102mesh[data[2]]) {
      icd102mesh[data[2]] = {};
    }
    icd102mesh[data[2]][data[0]] = data[1];


  }
  return [mesh2icd10, icd102mesh, mesh_names, icd10_names];
}

$(document).ready(function() {


  function handleFileSelect(evt) {
    var file = evt.target.files;
    var output = [];
    f = file[0];

    if (f.name != 'all_maps.csv') {
      alert("Please upload 'all_maps.csv' file.")
      return
    }

    var reader = new FileReader();
    reader.onload = (function(theFile) {
      return function(e) {
        var result = e.target.result;
        all_maps = processData(result);
        createMapTable(all_maps[0], all_maps[2]);
        $('.file-uploader').hide();
        $('#show-term-maps-btn').show();
        $('#table-maps').show();
        $('.prototype-ui').show();
      };
    })(f);

    reader.readAsText(f);
  }
  // document.getElementById('file').addEventListener('change', handleFileSelect, false);

  $.get('data/all_maps.csv', function(data) {
    all_maps = processData(data);
    createMapTable(all_maps[0], all_maps[2]);
  }, 'text');


  $('#togBtn').on('change', function() {
    if ($('.on').is(":visible")) {
      $('#progr-msg').show();
    } else {
      $('#progr-msg').hide();
    }
  })


  var date_start = $('input[name="start"]');
  var date_finish = $('input[name="finish"]');
  var options_start = {
    autoclose: true,
    assumeNearbyYear: true,
    clearBtn: true,
    endDate: '0d',
    format: 'yyyy/mm/dd',
    keepEmptyValues: true,
    title: "Start Date",
    todayBtn: 'linked',
    todayHighlight: true
  }
  var options_finish = {
    autoclose: true,
    assumeNearbyYear: true,
    clearBtn: true,
    endDate: '0d',
    format: 'yyyy/mm/dd',
    keepEmptyValues: true,
    title: "Finish Date",
    todayBtn: 'linked',
    todayHighlight: true
  }
  date_start.datepicker(options_start)
    .on('changeDate', function(selected) {
      var startDate = new Date(selected.date.valueOf());
      date_finish.datepicker('setStartDate', startDate);
    }).on('clearDate', function(selected) {
      date_finish.datepicker('setStartDate', null);
    });
  date_finish.datepicker(options_finish)
    .on('changeDate', function(selected) {
      var endDate = new Date(selected.date.valueOf());
      date_start.datepicker('setEndDate', endDate);
    }).on('clearDate', function(selected) {
      date_start.datepicker('setEndDate', null);
    });

  /// Submit Button
  $('#submit-button').click(function(e) {
    e.preventDefault();
    $('.warn').remove()
    var checkboxes = $('input[name^=institution]:checked')
    var start = $('input[name=start]')
    var finish = $('input[name=finish]')
    // Check if form is filled properly.
    if (checkboxes.length < 1) {
      if ($('#warn-msg1').length == 0) {
        $('<div id="warn-msg1" class="warn alert alert-danger alert-dismissible fade in"> \
          <a href="#" class="close" data-dismiss="alert" aria-label="close">&times;</a> \
          <strong>Error:</strong> No institution(s) chosen! \
        </div>').insertBefore($('#submit-button'))

      }
      return;
    }

    if (start.val() == "" && finish.val() != "") {
      if ($('#warn-msg2').length == 0) {
        $('<div id="warn-msg2" class="warn alert alert-danger alert-dismissible fade in"> \
          <a href="#" class="close" data-dismiss="alert" aria-label="close">&times;</a> \
          <strong>Error:</strong> Only end date specified! \
        </div>').insertBefore($('#submit-button'))

      }
      return;
    }

    // Clear previous messages in the log
    $('#msg-log').empty();

    // Set progress variables
    parts = checkboxes.length * 3;
    // Get results.
    $('#submit-button').prop('disabled', true);
    $('#submit-button').text('Please wait while retrieving results...');

    var datefilter = ""
    if (start.val() != "" && finish.val() != "") {
      datefilter = " AND " + start.val() + ":" + finish.val() + "[Publication Date]"
    } else if (start.val() != "" && finish.val() == "") {
      datefilter = " AND " + start.val() + "[Publication Date]"
    }


    results = {};
    iter = 0;
    loopCheckboxes(checkboxes, datefilter);


  });

});
