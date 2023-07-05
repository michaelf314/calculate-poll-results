let people;
let regex;
let halfLife;
let ineligible;
let points;
let votes;
let voters;
const duplicates = document.getElementById("duplicates");

function downloadTextFile(text) {
  var blob = new Blob([text], {type: "text/plain;charset=utf-8"});
  saveAs(blob, "results.csv");
}

function parseFile(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: resolve,
    });
  });
}

async function calculateResults() {
  people = document.getElementById("people").checked;
  regex = people ? /nm\d+/g : /tt\d+/g
  halfLife = document.getElementById("halfLife").value;
  ineligible = getIneligible();
  points = {};
  votes = {};
  voters = {};
  duplicates.value = '';
  let listSizes = [];
  
  let fileInput = document.getElementById("fileInput");
  let files = Array.from(fileInput.files);

  let results = await Promise.all(files.map(parseFile));

  for (let i = 0; i < results.length; i++) {
    let file = files[i];
    let filename = file.name;
    let voter = filename.replace(/( \(unranked\d*\))?\.csv$/, '');
    let unranked = filename.includes('unranked');
    let numRanked = filename.match(/(?<=unranked)\d+/);
    numRanked = numRanked ? numRanked[0] : 0;
    let col = results[i].meta.fields.find(field => /const/i.test(field));
    if (!col) {
      col = 'imdburl';
    }
    let urls = results[i].data.filter(row => row[col] && row[col].match(regex)).map(row => row[col]);
    let ids = urls.map(url => url.match(regex)[0]);
    let seen = {};
    ids = ids.filter((id, j) => {
      if (id in seen) {
        duplicates.value += `Duplicate in file ${filename} (${seen[id]+1}, ${j+1}): https://www.imdb.com/title/${id}/\n`
        return false;
      }
      if (ineligible.has(id)) {
        return false;
      }
      seen[id] = j;
      return true;
    });
    for (let j = 0; j < ids.length; j++) {
      updatePoints(ids[j], j+1, voter, ids.length, unranked, numRanked);
    }
    listSizes.push([ids.length, filename]);
  }
  listSizes = listSizes.sort((a, b) => a[0] - b[0]).map(e => `${e[0]} : ${e[1]}`);
  document.getElementById("listSizes").value = listSizes.join('\n');
  printResults();
}

function getIneligible() {
  let matches = document.getElementById("ineligible").value.match(regex);
  return matches ? new Set (matches) : new Set();
}

function updatePoints(id, rank, voter, listSize, unranked, numRanked) {
  let p;
  let r = unranked && rank > numRanked;
  // Calculate the mean of the terms from numRanked+1 to the last term.
  if (r) {
    p = (100 * .5 ** (numRanked / halfLife))
      * (1 - .5 ** ((listSize-numRanked) / halfLife))
      / (1 - .5 ** (1 / halfLife))
      / (listSize-numRanked);
  }
  else {
    p = 100 * .5 ** ((rank - 1) / halfLife);
  }
  points[id] = (points[id] || 0) + p;
  votes[id] = (votes[id] || 0) + 1;
  if (r) {
    r = 'unranked';
    if (numRanked)
      r += `>${numRanked}`;
  }
  else {
    r = `#${rank}`;
  }
  if (!voters[id]) {
    voters[id] = [];
  }
  voters[id].push([voter, r, p.toFixed(2)]);
}

function printResults() {
  let results = '';
  const sorted = Object.entries(points).sort((a, b) => b[1] - a[1]);
  for (const [id, points] of sorted) {
    const votersSorted = voters[id].sort((a, b) => b[2] - a[2])
      .map(v => `${v[0]} (${v[1]}) (${v[2]} pts)`).join('\n');
    results += `"https://www.imdb.com/${people ? 'name' : 'title'}/${id}/","${points}","${votes[id]}","${votersSorted}"\n`;
  }
  downloadTextFile(results);
}
