// ==UserScript==
// @name         Refresh Glastonbury Tix
// @namespace    https://glastonbury.seetickets.com
// @version      0.1
// @description  Refresh-bot to find tix
// @author       Christina
// @match        https://glastonbury.seetickets.com/*
// @icon         https://cdn.glastonburyfestivals.co.uk/wp-content/themes/glasto/assets/favicon/favicon-32x32.png
// @grant        window.focus
// @grant        GM_notification
// @run-at       document-end
// @updateURL    https://raw.githubusercontent.com/presumption/glasto-refresh-script/main/glasto-refresh-script.js
// @downloadURL  https://raw.githubusercontent.com/presumption/glasto-refresh-script/main/glasto-refresh-script.js
// ==/UserScript==

// How the script works:
// The script checks if we are on the queue page. If we are, it will refresh the page. Otherwise, it will assume we are on the tix booking form and send a desktop notification.

// How to use the script:
// 1. Install the Tampermonkey extension (there is a version for Chrome and Firefox). Make sure the extension icon has appeared in your browser toolbar.
// 2. Create a new script within Tampermonkey and replace the default content of the script with the full contents of this file. Save the script.
// 3. Go to the Glastonbury tix page and check that the script is active -- when you click on Tampermonkey, it shows the list of active scripts for the current page. This script is configured to run on the Glastonbury tix page.

// How to edit the saved script:
// 1. Click Tampermonkey while on the Glastonbury tix page, then click the arrow next to this script, then "Edit".
// 2. Make the changes you want and save. Refresh the page you're on (the script runs on page load).


(function () {
  "use strict";

  window.addEventListener("load", function () {
    let style = el("style");
    style.innerText = "" +
      ".glasto-ui { position: fixed; left: 0; top: 0; background: white; border: 4px solid yellow; border-radius: 4px; padding: 2px 8px; display: flex; flex-flow: column nowrap; font-size: 12px; }\n" +
      ".glasto-ui input { padding: 2px; font-size: 14px; }\n" +
      ".glasto-ui hr { margin-top: 4px; }\n" +
      ".glasto-ui-reload { display: flex; flex-flow: row; }\n" +
      ".glasto-ui-reload input { width: 6em; margin-left: 4px; }\n" +
      ".glasto-ui-waiting { display: flex; flex-flow: column; }\n" +
      ".glasto-ui .glasto-name-input { width: 12em; }\n" +
      ".glasto-ui .glasto-regnum-input { width: 7em; }\n" +
      ".glasto-ui .glasto-zip-input { width: 5em; }\n" +
      ".glasto-ui .glasto-delete-button { background-color: red; color: white; font-size: 12px; padding: 2px; }\n" +
      ".glasto-ui .glasto-delete-button:hover { background-color: darkred; cursor: pointer; }\n" +
      "";
    window.document.head.appendChild(style);

    let ui = el("div");
    ui.setAttribute("class", "glasto-ui");

    // reload text variable
    let reloadLabel = el("label");
    reloadLabel.innerText = "Page reload delay (ms):";
    reloadLabel.classList = ["glasto-ui-reload"];
    let reloadInput = el("input");
    let reloadDelay = window.localStorage.getItem("reload_delay") || 200;
    window.localStorage.setItem("reload_delay", reloadDelay);
    reloadInput.setAttribute("type", "number");
    reloadInput.value = reloadDelay;
    reloadInput.addEventListener("input", function (e) {
      let newValue = parseInt(e.target.value.replace(/[^0-9]/g, "") || "0"); // empty string -> 0
      e.target.value = newValue;
      window.localStorage.setItem("reload_delay", newValue);
    });
    reloadLabel.appendChild(reloadInput);
    ui.appendChild(reloadLabel);

    // waiting text variable
    let waitingLabel = el("label");
    waitingLabel.innerText = "Queueing page text:";
    waitingLabel.classList = ["glasto-ui-waiting"];
    let waitingInput = el("input");
    let waitingText = window.localStorage.getItem("waiting_text") || "You will be held";
    window.localStorage.setItem("waiting_text", waitingText);
    waitingInput.setAttribute("type", "text");
    waitingInput.value = waitingText;
    waitingInput.addEventListener("input", function (e) {
      let newValue = e.target.value;
      window.localStorage.setItem("waiting_text", newValue);
    });
    waitingLabel.appendChild(waitingInput);
    ui.appendChild(waitingLabel);

    // festivalgoers details
    // header
    let table = el("table");
    table.setAttribute("id", "glasto-persons-table");
    let header = el("tr");
    let headerDelete = el("th");
    headerDelete.innerText = "DELETE";
    let headerId = el("th");
    headerId.innerText = "ID";
    let headerName = el("th");
    headerName.innerText = "Name";
    let headerRegNum = el("th");
    headerRegNum.innerText = "Reg number";
    let headerZip = el("th");
    headerZip.innerText = "Zip code";
    let headerAddr = el("th");
    headerAddr.innerText = "Address";
    header.append(headerDelete, headerId, headerName, headerRegNum, headerZip, headerAddr);
    table.appendChild(header);
    // rows
    let persons = loadPersons();
    console.log("Loaded persons:", persons);
    for (let i in persons) {
      let row = personRow(persons[i]);
      table.appendChild(row);
    }

    ui.appendChild(table);

    // paste new person details
    let addPersonInput = el("input");
    addPersonInput.setAttribute("placeholder", "Paste one row or multiple rows from the spreadsheet here...");
    addPersonInput.addEventListener("paste", function (e) {
      let pastedData = e.clipboardData.getData("Text");
      let rows = pastedData.split("\n");
      for (let i in rows) {
        addPerson(nextId(), rows[i]);
      }
      e.preventDefault();
    });
    ui.appendChild(addPersonInput);

    document.body.appendChild(ui);
  });

  window.addEventListener("load", function () {
    if (isWaitingPage()) {
      refresh();
    } else {
      notify();
    }
  });

  function nextId() {
    let persons = loadPersons();
    let max = 0;
    for (let i in persons) {
      let personId = parseInt(persons[i]);
      if (personId > max) {
        max = personId;
      }
    }
    return max + 1;
  }

  function personRow(personId) {
    let row = el("tr");
    row.setAttribute("id", "glasto-person-row-" + personId);

    let cellId = el("td");
    cellId.innerText = personId;

    let cellName = el("td");
    let cellNameInput = el("input");
    cellNameInput.classList = "glasto-name-input";
    cellName.appendChild(cellNameInput);
    cellNameInput.value = window.localStorage.getItem("glasto-name-" + personId) || "";
    cellNameInput.addEventListener("input", function (e) {
      window.localStorage.setItem("glasto-name-" + personId, e.target.value);
    });

    let cellRegNum = el("td");
    let cellRegNumInput = el("input");
    cellRegNumInput.classList = "glasto-regnum-input";
    cellRegNum.appendChild(cellRegNumInput);
    cellRegNumInput.value = window.localStorage.getItem("glasto-regnum-" + personId) || "";
    cellRegNumInput.addEventListener("input", function (e) {
      window.localStorage.setItem("glasto-regnum-" + personId, e.target.value);
    });

    let cellZip = el("td");
    let cellZipInput = el("input");
    cellZipInput.classList = "glasto-zip-input";
    cellZip.appendChild(cellZipInput);
    cellZipInput.value = window.localStorage.getItem("glasto-zip-" + personId) || "";
    cellZipInput.addEventListener("input", function (e) {
      window.localStorage.setItem("glasto-zip-" + personId, e.target.value);
    });

    let cellAddr = el("td");
    let cellAddrInput = el("input");
    cellAddr.appendChild(cellAddrInput);
    cellAddrInput.value = window.localStorage.getItem("glasto-addr-" + personId) || "";
    cellAddrInput.addEventListener("input", function (e) {
      window.localStorage.setItem("glasto-addr-" + personId, e.target.value);
    });

    let cellDelete = el("td");
    let cellDeleteButton = el("button");
    cellDeleteButton.innerText = "X";
    cellDeleteButton.classList = "glasto-delete-button";
    cellDelete.appendChild(cellDeleteButton);
    cellDeleteButton.addEventListener("click", function () {
      deletePerson(personId);
    });

    row.append(cellDelete, cellId, cellName, cellRegNum, cellZip, cellAddr);
    console.log("Festivalgoer #", cellId.innerText, cellNameInput.value, cellRegNumInput.value, cellZipInput.value, cellAddrInput.value);
    return row;
  }

  function addPerson(personId, data) {
    let parts = data.split("\t");
    let name = parts[0] || "";
    let regnum = parts[1] || "";
    let zip = parts[2] || "";
    let addr = parts[3] || "";
    console.log("Adding festivalgoer #", personId, name, regnum, zip, addr);
    window.localStorage.setItem("glasto-name-" + personId, name);
    window.localStorage.setItem("glasto-regnum-" + personId, regnum);
    window.localStorage.setItem("glasto-zip-" + personId, zip);
    window.localStorage.setItem("glasto-addr-" + personId, addr);

    let persons = loadPersons();
    persons.push(personId);
    savePersons(persons);

    let row = personRow(personId);
    let table = document.getElementById("glasto-persons-table");
    table.appendChild(row);
  }

  function deletePerson(personId) {
    console.log("Deleting festivalgoer #", personId);
    let table = document.getElementById("glasto-persons-table");
    let row = document.getElementById("glasto-person-row-" + personId);
    table.removeChild(row);
    window.localStorage.removeItem("glasto-name-" + personId);
    window.localStorage.removeItem("glasto-regnum-" + personId);
    window.localStorage.removeItem("glasto-zip-" + personId);
    window.localStorage.removeItem("glasto-addr-" + personId);

    let persons = loadPersons();
    persons = persons.filter(function (person) {
      return "" + person != "" + personId;
    });
    savePersons(persons);
    console.log("Updated persons:", persons);
  }

  function loadPersons() {
    return (window.localStorage.getItem("glasto-persons") || "")
      .split(",")
      .filter(function (personId) {
        return !!parseInt(personId);
      })
      .map(function (personId) {
        return parseInt(personId);
      })
      .sort();
  }

  function savePersons(persons) {
    persons = persons.map(function (personId) {
      return parseInt(personId);
    });
    window.localStorage.setItem("glasto-persons", persons);
    console.log("Updated persons:", persons);
  }

  function el(tagName) {
    return window.document.createElement(tagName);
  }

  function notify() {
    showNotification("Glastonbury tix!", "Click this notification to switch to the correct tab");
  }

  function refresh() {
    let reloadDelay = window.localStorage.getItem("reload_delay") || 200;
    setTimeout(function () {
      window.location.reload();
    }, reloadDelay);
  }

  function isWaitingPage() {
    let waitingText = window.localStorage.getItem("waiting_text") || "You will be held";
    let found = document.body.innerHTML.toString().indexOf(waitingText) > -1;
    if (found) {
      console.log("Page contains text: " + waitingText);
    } else {
      console.log("Page does not contain text: " + waitingText);
    }
    return found;
  }

  function showNotification(title, text) {
    let doNotify = function () {
      console.log(title);
      console.log(text);
      let notification = new Notification(title, {
        body: text,
        icon: "https://cdn.glastonburyfestivals.co.uk/wp-content/themes/glasto/assets/favicon/favicon-32x32.png",
        requireInteraction: true,
        tag: "glastonbury",
        renotify: true
      });
      notification.addEventListener("click", function () {
        parent.focus();
        window.focus();
        this.close();
      });
    };

    if (Notification.permission === "granted") {
      doNotify();
    } else {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          doNotify();
        }
      });
    }
  }
})();
