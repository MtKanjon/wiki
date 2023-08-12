// SPDX-License-Identifier: MPL-2.0

const index = elasticlunr.Index.load(window.searchIndex);
const searchOptions = {
  bool: "AND",
  fields: {
    title: { boost: 2 },
    body: { boost: 1 },
  },
};

if (window.location.pathname === "/search") {
  const q = decodeURIComponent(
    window.location.search.split("?q=")[1].replace(/\+/g, "%20")
  );
  document.getElementById("query").value = q;

  const results = index.search(q, searchOptions);

  const elements = [];
  for (const result of results) {
    if (!result?.doc?.body) {
      continue;
    }

    console.log(result.ref, result.doc.title, result.doc.body);
    const div = document.createElement("div");
    div.className = "result";

    const link = document.createElement("a");
    link.href = result.ref;
    link.innerText = result.doc.title;
    div.appendChild(link);

    const teaser = document.createElement("p");
    teaser.innerHTML = makeTeaser(result.doc.body, q.split(" "));
    div.appendChild(teaser);

    elements.push(div);
  }

  const resultsDiv = document.getElementById("results");
  resultsDiv.innerHTML = "";

  if (elements.length === 0) {
    resultsDiv.innerText = "no results found";
  } else {
    resultsDiv.append(...elements);
  }
}

// from https://github.com/rust-lang/mdBook
// SPDX-License-Identifier: MPL-2.0
function makeTeaser(body, searchterms) {
  // The strategy is as follows:
  // First, assign a value to each word in the document:
  //  Words that correspond to search terms (stemmer aware): 40
  //  Normal words: 2
  //  First word in a sentence: 8
  // Then use a sliding window with a constant number of words and count the
  // sum of the values of the words within the window. Then use the window that got the
  // maximum sum. If there are multiple maximas, then get the last one.
  // Enclose the terms in <em>.
  var stemmed_searchterms = searchterms.map(function (w) {
    return elasticlunr.stemmer(w.toLowerCase());
  });
  var searchterm_weight = 40;
  var weighted = []; // contains elements of ["word", weight, index_in_document]
  // split in sentences, then words
  var sentences = body.toLowerCase().split(". ");
  var index = 0;
  var value = 0;
  var searchterm_found = false;
  for (var sentenceindex in sentences) {
    var words = sentences[sentenceindex].split(" ");
    value = 8;
    for (var wordindex in words) {
      var word = words[wordindex];
      if (word.length > 0) {
        for (var searchtermindex in stemmed_searchterms) {
          if (
            elasticlunr
              .stemmer(word)
              .startsWith(stemmed_searchterms[searchtermindex])
          ) {
            value = searchterm_weight;
            searchterm_found = true;
          }
        }
        weighted.push([word, value, index]);
        value = 2;
      }
      index += word.length;
      index += 1; // ' ' or '.' if last word in sentence
    }
    index += 1; // because we split at a two-char boundary '. '
  }

  if (weighted.length == 0) {
    return body;
  }

  var window_weight = [];
  var window_size = Math.min(weighted.length, 30);

  var cur_sum = 0;
  for (var wordindex = 0; wordindex < window_size; wordindex++) {
    cur_sum += weighted[wordindex][1];
  }
  window_weight.push(cur_sum);
  for (
    var wordindex = 0;
    wordindex < weighted.length - window_size;
    wordindex++
  ) {
    cur_sum -= weighted[wordindex][1];
    cur_sum += weighted[wordindex + window_size][1];
    window_weight.push(cur_sum);
  }

  if (searchterm_found) {
    var max_sum = 0;
    var max_sum_window_index = 0;
    // backwards
    for (var i = window_weight.length - 1; i >= 0; i--) {
      if (window_weight[i] > max_sum) {
        max_sum = window_weight[i];
        max_sum_window_index = i;
      }
    }
  } else {
    max_sum_window_index = 0;
  }

  // add <em/> around searchterms
  var teaser_split = [];
  var index = weighted[max_sum_window_index][2];
  for (
    var i = max_sum_window_index;
    i < max_sum_window_index + window_size;
    i++
  ) {
    var word = weighted[i];
    if (index < word[2]) {
      // missing text from index to start of `word`
      teaser_split.push(body.substring(index, word[2]));
      index = word[2];
    }
    if (word[1] == searchterm_weight) {
      teaser_split.push("<em>");
    }
    index = word[2] + word[0].length;
    teaser_split.push(body.substring(word[2], index));
    if (word[1] == searchterm_weight) {
      teaser_split.push("</em>");
    }
  }

  return teaser_split.join("");
}
