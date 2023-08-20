let globalDiffFile = '';
let oldTreeText = '';
let newTreeText = '';
let cacheGlobal = '<cache></cache>'

function createBibliography() {
    const colors = [
        ['#ABF5D1', '#87DEB3'],
        ['#FA9D9D', '#FA8383'],
        ['#92ceec', '#7eb3cd'],
        ['#e3e372', '#cdcd67'],
        ['#92ceec', '#7eb3cd'],
    ];

    const explanations = [
        "Green rows: Newly added elements in the new tree.",
        "Red rows: Elements deleted from the old tree.",
        "Blue rows: Elements moved to new positions in the new tree.",
        "Yellow rows: Elements updated in the new tree.",
        "Striped (blue/yellow) rows: Elements updated and relocated in the new tree."
    ];

    const table = document.createElement('table');
    table.style.borderCollapse = 'collapse';

    for (let i = 0; i < colors.length; i++) {
        const row = document.createElement('tr');

        // Create the color stripe cells
        for (let j = 0; j < colors[i].length; j++) {
            const colorCell = document.createElement('td');
            colorCell.style.backgroundColor = colors[i][j];
            colorCell.style.width = '100px'; // Adjust the width as needed
            colorCell.style.border = '1px solid black';
            // Striped rows
            if (i == 4) {
                if (j == 0) {
                    colorCell.style.backgroundImage = 'linear-gradient(45deg, #e3e372 25%, transparent 25%, transparent 50%, #e3e372 50%, #e3e372 75%, transparent 75%, #92ceec)'
                } else {
                    colorCell.style.backgroundImage = 'linear-gradient(45deg, #cdcd67 25%, transparent 25%, transparent 50%, #cdcd67 50%, #cdcd67 75%, transparent 75%, #7eb3cd)'
                }
                colorCell.style.backgroundSize = '50px 50px';
            }
            row.appendChild(colorCell);
        }

        // Create the explanation cell
        const explanationCell = document.createElement('td');
        explanationCell.textContent = explanations[i];
        explanationCell.style.border = '1px solid black';
        row.appendChild(explanationCell);

        table.appendChild(row);
    }

    // Add "Important: !" row as the last row
    const lastRow = document.createElement('tr');
    const importantCell = document.createElement('td');
    importantCell.textContent = 'Important: All "parallel_branch" nodes must retain the same order!';
    importantCell.style.border = '1px solid black';
    importantCell.style.textAlign = 'center';
    importantCell.style.fontWeight = 'bold';
    importantCell.style.backgroundColor = '#FFFF99'; // Yellow background
    importantCell.colSpan = 3; // Span across all columns
    lastRow.appendChild(importantCell);
    table.appendChild(lastRow);


    const bibliographyDiv = document.getElementById('bibliography');
    bibliographyDiv.appendChild(table);
}


function uploadTrees() {
    resetTrees();

    const fileInput1 = document.getElementById('fileInput1');
    const fileInput2 = document.getElementById('fileInput2');
    const files1 = fileInput1.files;
    const files2 = fileInput2.files;

    if (files1.length !== 1 || files2.length !== 1) {
        alert('Please select exactly 2 XML files');
        return Promise.reject(new Error('Invalid file selection'));
    }

    const reader1 = new FileReader();
    const reader2 = new FileReader();

    return new Promise((resolve, reject) => {
        reader1.onload = function (event) {
            const content1 = event.target.result;
            reader2.readAsText(files2[0]);
            reader2.onload = function (event) {
                const content2 = event.target.result;

                // Combine the contents with '&'
                const combinedContent = content1.trim() + '&' + content2.trim();
                oldTreeText = content1;
                newTreeText = content2;

                // Send the combined content to the backend server
                sendTreesToServer(combinedContent)
                    .then(() => resolve())
                    .catch(error => reject(error));
            };
        };

        reader1.readAsText(files1[0]);
    });
}

function sendTreesToServer(content) {
    return fetch($('body').attr('data-backend'), {
        headers: {
            'Content-Type': 'text/xml'
        },
        method: 'POST',
        body: content
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Server response error: ${response.status} ${response.statusText}`);
            }
            return response.text();
        })
        .then(diffFile => {
            globalDiffFile = diffFile;
            displayDiffFile(diffFile);
        });
}

// Function to display the diff file on the webpage
function displayDiffFile(diffFile) {
    const diffOutput = document.getElementById('diffOutput');
    diffOutput.textContent = diffFile;
}

function displayTrees() {
    uploadTrees()
        .then(() => {
            displayBothTrees(oldTreeText, '#oldTree', '#graphcanvas1', newTreeText, '#newTree', '#graphcanvas2');
        })
        .catch(error => {
            console.error('Error during upload and processing:', error);
        });
}

function resetTrees() {
    document.querySelector('#treeWrapper').innerHTML = '<div id="oldTree">\n' +
        '        <svg xmlns="http://www.w3.org/2000/svg" version="1.1" xmlns:x="http://www.w3.org/1999/xlink" id="graphcanvas1" width="1" height="1" class="svgStyle"></svg>\n' +
        '    </div>\n' +
        '    <div id="newTree">\n' +
        '        <svg xmlns="http://www.w3.org/2000/svg" version="1.1" xmlns:x="http://www.w3.org/1999/xlink" id="graphcanvas2" width="1" height="1" class="svgStyle"></svg>\n' +
        '    </div>';
}


function displayBothTrees(oldTreeXML, oldDivId, oldSvgId, newTreeXML, newDivId, newSvgId) {
    var parser, oldXmlDoc, oldXmlDocClone, newXmlDoc, cache;

    let insertsArray = [];
    let deleteArray = [];
    let moveOldArray = [];
    let moveNewArray = new Map();
    let updateArray = new Map();

    parser = new DOMParser();

    oldXmlDoc = parser.parseFromString(oldTreeXML, "text/xml");
    removeCommentsFromXmlDoc(oldXmlDoc);

    oldXmlDocClone = parser.parseFromString(oldTreeXML, "text/xml");
    removeCommentsFromXmlDoc(oldXmlDocClone);

    newXmlDoc = parser.parseFromString(newTreeXML, "text/xml");
    removeCommentsFromXmlDoc(newXmlDoc);

    const diffDoc = parser.parseFromString(globalDiffFile, "text/xml");
    const diffElements = diffDoc.children[0].children;

    cache = parser.parseFromString(cacheGlobal, "text/xml");

    let arrayOfOldTree = [
        {
            isStart: false,
            hasEnd: false,
            isEnd: false,
            treeElement: null,
            originPath: [],
            currentPath: [],
            colorOperations: [],
            emptyInOtherTree: false
        },
    ];
    let arrayOfOldTreeClone = [
        {
            isStart: false,
            hasEnd: false,
            isEnd: false,
            treeElement: null,
            originPath: [],
            currentPath: [],
            colorOperations: [],
            emptyInOtherTree: false
        },
    ];
    let arrayOfNewTree = [
        {
            isStart: false,
            hasEnd: false,
            isEnd: false,
            treeElement: null,
            originPath: [],
            currentPath: [],
            colorOperations: [],
            emptyInOtherTree: false
        },
    ];

    xmlDocToArray(newXmlDoc, arrayOfNewTree);
    xmlDocToArray(oldXmlDoc, arrayOfOldTree);
    xmlDocToArray(oldXmlDocClone, arrayOfOldTreeClone);


    for (let i = 0; i < diffElements.length; i++) {
        const diffElement = diffElements[i];
        if (diffElement.tagName === "insert") {
            const newPath = diffElement.getAttribute("newPath");
            if (newPath) {
                const newPathArray = newPath.split("/").map(Number);
                const parentPath = newPathArray.slice(0, newPathArray.length - 1);
                setHasEndAttribute(arrayOfOldTreeClone, parentPath, diffElement.children[0]);
                let index = insertInArrayAccordingToPath(arrayOfOldTreeClone, newPathArray, diffElement.children[0]);
                for (let j = index; j < index + necessaryEmptyCount(arrayOfOldTreeClone[index].treeElement); j++) {
                    arrayOfOldTreeClone[j].emptyInOtherTree = true;
                    arrayOfOldTreeClone[j].colorOperations.push("insert");
                }
                index = resolveParallelChildrenForInsert(arrayOfOldTreeClone, parentPath, index);
            }
        }
        if (diffElement.tagName === "delete") {
            const oldPath = diffElement.getAttribute("oldPath");
            if (oldPath) {
                const oldPathArray = oldPath.split("/").map(Number);
                const parentPath = oldPathArray.slice(0, oldPathArray.length - 1);

                let index = deleteFromArrayAccordingToPath(arrayOfOldTreeClone, oldPathArray, arrayOfOldTree);
                for (let j = index; j < index + necessaryEmptyCount(arrayOfOldTree[index].treeElement); j++) {
                    arrayOfOldTree[j].emptyInOtherTree = true;
                    arrayOfOldTree[j].colorOperations.push("delete");
                }
                resolveParallelChildrenForDelete(arrayOfOldTreeClone, parentPath, arrayOfOldTree[index].treeElement, arrayOfOldTree);

            }
        }
        if (diffElement.tagName === "move") {
            const oldPath = diffElement.getAttribute("oldPath");
            const newPath = diffElement.getAttribute("newPath");

            if (oldPath && newPath) {
                const oldPathArray = oldPath.split("/").map(Number);
                const newPathArray = newPath.split("/").map(Number);
                let indexCurrentTree = getIndexFromArrayAccordingToPath(arrayOfOldTreeClone, oldPathArray, false);
                let colorOperations = [];
                let originPaths = [];
                for (let j = indexCurrentTree; j < indexCurrentTree + necessaryEmptyCount(arrayOfOldTreeClone[indexCurrentTree].treeElement); j++) {
                    colorOperations.push(JSON.parse(JSON.stringify(arrayOfOldTreeClone[j].colorOperations)));
                    originPaths.push(JSON.parse(JSON.stringify(arrayOfOldTreeClone[j].originPath)));
                }

                let treeElement = arrayOfOldTreeClone[indexCurrentTree].treeElement;
                let index = deleteFromArrayAccordingToPath(arrayOfOldTreeClone, oldPathArray, arrayOfOldTree);
                for (let j = index; j < index + necessaryEmptyCount(arrayOfOldTree[index].treeElement); j++) {
                    arrayOfOldTree[j].emptyInOtherTree = true;
                    arrayOfOldTree[j].colorOperations.push("move");
                }
                let parentPath = oldPathArray.slice(0, oldPathArray.length - 1);
                resolveParallelChildrenForDelete(arrayOfOldTreeClone, parentPath, arrayOfOldTree[index].treeElement, arrayOfOldTree);

                parentPath = newPathArray.slice(0, newPathArray.length - 1);
                treeElement.setAttribute('hasEnd', 'false');
                setHasEndAttribute(arrayOfOldTreeClone, parentPath, treeElement);
                index = insertInArrayAccordingToPath(arrayOfOldTreeClone, newPathArray, treeElement);
                index = resolveParallelChildrenForInsert(arrayOfOldTreeClone, parentPath, index);


                for (let j = index; j < index + necessaryEmptyCount(arrayOfOldTreeClone[index].treeElement); j++) {
                    arrayOfOldTreeClone[j].colorOperations = colorOperations[j - index];
                    if (!arrayOfOldTreeClone[j].colorOperations) {
                        arrayOfOldTreeClone[j].colorOperations = colorOperations[0]
                    }
                    arrayOfOldTreeClone[j].originPath = originPaths[j - index];
                    if (!arrayOfOldTreeClone[j].originPath) {
                        arrayOfOldTreeClone[j].originPath = originPaths[0]
                    }

                    arrayOfOldTreeClone[j].emptyInOtherTree = true;
                    arrayOfOldTreeClone[j].colorOperations.push("move");
                    if (newPathArray > oldPathArray) {
                        // movedFrom = "⬆️";
                        arrayOfOldTreeClone[j].colorOperations.push("&#11014;&#65039;");
                    } else if (newPathArray < oldPathArray) {
                        // movedFrom = "⬇️";
                        arrayOfOldTreeClone[j].colorOperations.push("&#11015;&#65039;");
                    } else {
                        // movedFrom = "↔️";
                        arrayOfOldTreeClone[j].colorOperations.push("&#8596;&#65039;");
                    }
                }
            }
        }
        if (diffElement.tagName === "update") {
            const oldPath = diffElement.getAttribute("oldPath");

            if (oldPath) {
                const oldPathArray = oldPath.split("/").map(Number);

                let indexCurrentTree = getIndexFromArrayAccordingToPath(arrayOfOldTreeClone, oldPathArray, true);
                let indexOldTree = getIndexFromArrayAccordingToPath(arrayOfOldTree, arrayOfOldTreeClone[indexCurrentTree].originPath, false);

                let children = diffElement.children;
                let stringWithHtmlUpdated = "";
                for (let i = 0; i < children.length; i++) {
                    stringWithHtmlUpdated += children[i].outerHTML;
                    if (children[i].nodeName == "loop") {
                        // Because it changes the number of rows
                        let newMode = children[i].getAttribute('mode');
                        let oldMode = arrayOfOldTreeClone[indexCurrentTree].treeElement.getAttribute('mode');

                        if (newMode) {
                            if (newMode == 'pre_test' && (!(oldMode) || oldMode == "post_test")) {
                                arrayOfOldTreeClone[indexCurrentTree].hasEnd = false;
                                deleteFromArray(arrayOfOldTreeClone, indexCurrentTree + necessaryEmptyCount(arrayOfOldTreeClone[indexCurrentTree].treeElement) - 1);
                                arrayOfOldTree[indexOldTree + necessaryEmptyCount(arrayOfOldTree[indexOldTree].treeElement) - 1].emptyInOtherTree = true;
                            }

                        } else if (oldMode) {
                            if (oldMode == 'pre_test' && (!(newMode) || newMode == "post_test")) {
                                arrayOfOldTreeClone[indexCurrentTree].hasEnd = true;
                                insertInArray(arrayOfOldTreeClone, indexCurrentTree + necessaryEmptyCount(arrayOfOldTreeClone[indexCurrentTree].treeElement), {
                                    isStart: false,
                                    hasEnd: true,
                                    isEnd: true,
                                    treeElement: arrayOfOldTreeClone[indexCurrentTree].treeElement,
                                    originPath: JSON.parse(JSON.stringify(arrayOfOldTreeClone[indexCurrentTree].originPath)),
                                    currentPath: JSON.parse(JSON.stringify(arrayOfOldTreeClone[indexCurrentTree].currentPath)),
                                    colorOperations: JSON.parse(JSON.stringify(arrayOfOldTreeClone[indexCurrentTree].colorOperations)),
                                    emptyInOtherTree: true
                                })
                            }
                        }


                        arrayOfOldTreeClone[indexCurrentTree].treeElement.setAttribute('mode', children[i].getAttribute('mode'));
                    }
                }

                for (let j = indexCurrentTree; j < indexCurrentTree + necessaryEmptyCount(arrayOfOldTreeClone[indexCurrentTree].treeElement); j++) {
                    arrayOfOldTreeClone[j].colorOperations.push("update");
                    if (j == indexCurrentTree || (j == indexCurrentTree + necessaryEmptyCount(arrayOfOldTreeClone[indexCurrentTree].treeElement) - 1 && arrayOfOldTreeClone[j].isEnd)) {
                        arrayOfOldTreeClone[j].colorOperations.push(escapeHtml(stringWithHtmlUpdated))
                    } else {
                        arrayOfOldTreeClone[j].colorOperations.push('')
                    }

                }

                for (let j = indexOldTree; j < indexOldTree + necessaryEmptyCount(arrayOfOldTree[indexOldTree].treeElement); j++) {
                    arrayOfOldTree[j].colorOperations.push("update");
                }

            }
        }
    }

    let indexForBoth = 0;
    for (indexForBoth = 0; (indexForBoth < arrayOfOldTreeClone.length) && (indexForBoth < arrayOfOldTree.length); indexForBoth++) {
        if (arrayOfOldTreeClone[indexForBoth].emptyInOtherTree) {
            const emptyElement = cache.createElement("empty");
            insertEmptyElementInTree(emptyElement, arrayOfOldTree, indexForBoth);
            insertXMLElementInArray(emptyElement, [], [], indexForBoth, arrayOfOldTree);
        }

        if (arrayOfOldTree[indexForBoth].emptyInOtherTree) {
            const emptyElement = cache.createElement("empty");
            insertEmptyElementInTree(emptyElement, arrayOfNewTree, indexForBoth);
            insertXMLElementInArray(emptyElement, [], [], indexForBoth, arrayOfOldTreeClone);
            insertXMLElementInArray(emptyElement, [], [], indexForBoth, arrayOfNewTree);
        }
    }
    for (let i = indexForBoth; i < arrayOfOldTreeClone.length; i++) {
        if (arrayOfOldTreeClone[i].emptyInOtherTree) {
            const emptyElement = cache.createElement("empty");
            insertEmptyElementInTree(emptyElement, arrayOfOldTree, i);
            insertXMLElementInArray(emptyElement, [], [], i, arrayOfOldTree);
        }
    }
    for (let i = indexForBoth; i < arrayOfOldTree.length; i++) {
        if (arrayOfOldTree[i].emptyInOtherTree) {
            const emptyElement = cache.createElement("empty");
            insertEmptyElementInTree(emptyElement, arrayOfNewTree, i);
            insertXMLElementInArray(emptyElement, [], [], i, arrayOfOldTreeClone);
            insertXMLElementInArray(emptyElement, [], [], i, arrayOfNewTree);
        }
    }

    for (let i = 0; i < arrayOfOldTree.length; i++) {
        let colorArray = arrayOfOldTree[i].colorOperations;
        for (let j = 0; j < colorArray.length; j++) {
            switch (colorArray[j]) {
                case "delete":
                    deleteArray.push(i);
                    break;

                case "move":
                    moveOldArray.push(i);
                    break;

                case "update":
                    updateArray.set(i, "");
                    break;
                default:
            }
        }
    }

    for (let i = 0; i < arrayOfOldTreeClone.length; i++) {
        let colorArray = arrayOfOldTreeClone[i].colorOperations;
        for (let j = 0; j < colorArray.length; j++) {
            switch (colorArray[j]) {
                case "insert":
                    insertsArray.push(i)
                    break;

                case "move":
                    moveNewArray.set(i, colorArray[j + 1])
                    break;

                case "update":
                    updateArray.set(i, colorArray[j + 1])
                    break;
                default:
            }
        }
    }


    displayOneTree(oldDivId, oldSvgId, oldXmlDoc, insertsArray, deleteArray, moveOldArray, moveNewArray, updateArray)
        .then(() => {
            displayOneTree(newDivId, newSvgId, newXmlDoc, insertsArray, deleteArray, moveOldArray, moveNewArray, updateArray).then(() => {
                document.getElementById("oldTree").innerHTML += "";
                document.getElementById("newTree").innerHTML += "";
            });
        })
        .catch((error) => {
            console.error(error);
        });


}

function setHasEndAttribute(arrayOfTree, pathOfParallel, newElement) {
    let indexOfParallel = -1;
    let hadOtherNodes = false;
    for (let i = 0; i < arrayOfTree.length; i++) {
        if (arrayOfTree[i].currentPath + "" == pathOfParallel + "") {
            indexOfParallel = i;
            break;
        }
    }
    if (indexOfParallel == -1 || arrayOfTree[indexOfParallel].treeElement.nodeName != "parallel" || newElement.nodeName != "parallel_branch") {
        return;
    }
    let currentIndex = indexOfParallel + 1;
    while (currentIndex < indexOfParallel + necessaryEmptyCount(arrayOfTree[indexOfParallel].treeElement) - 1) {
        if (arrayOfTree[currentIndex].treeElement.nodeName != "parallel_branch") {
            hadOtherNodes = true;
            break;
        }
        currentIndex += necessaryEmptyCount(arrayOfTree[currentIndex].treeElement);
    }
    if (hadOtherNodes) {
        newElement.setAttribute('hasEnd', 'true')
    }
}

// after removing a non "parallel_branch" node from a parallel node
function resolveParallelChildrenForDelete(arrayOfOldCloneTree, pathOfParallel, deletedElement, arrayOfOldTree) {
    let indexOfParallel = -1;
    let otherNodesLeft = false;
    for (let i = 0; i < arrayOfOldCloneTree.length; i++) {
        if (arrayOfOldCloneTree[i].currentPath + "" == pathOfParallel + "") {
            indexOfParallel = i;
            break;
        }
    }
    if (indexOfParallel == -1 || arrayOfOldCloneTree[indexOfParallel].treeElement.nodeName != "parallel" || deletedElement.nodeName == "parallel_branch") {
        return;
    }

    let currentIndex = indexOfParallel + 1;
    while (currentIndex < indexOfParallel + necessaryEmptyCount(arrayOfOldCloneTree[indexOfParallel].treeElement) - 1) {
        if (arrayOfOldCloneTree[currentIndex].treeElement.nodeName != "parallel_branch") {
            otherNodesLeft = true;
            break;
        }
        currentIndex += necessaryEmptyCount(arrayOfOldCloneTree[currentIndex].treeElement);
    }
    if (!otherNodesLeft) {
        currentIndex = indexOfParallel + 1;
        while (currentIndex < indexOfParallel + necessaryEmptyCount(arrayOfOldCloneTree[indexOfParallel].treeElement) - 1) {

            arrayOfOldCloneTree[currentIndex].hasEnd = false;

            deleteFromArray(arrayOfOldCloneTree, currentIndex + necessaryEmptyCount(arrayOfOldCloneTree[currentIndex].treeElement) - 1);


            arrayOfOldCloneTree[currentIndex].treeElement.setAttribute('hasEnd', 'false')

            currentIndex += necessaryEmptyCount(arrayOfOldCloneTree[currentIndex].treeElement);
        }
    }

    let indexOfParallelOrigin = -1;
    let originPathParallel = arrayOfOldCloneTree[indexOfParallel].originPath;
    for (let i = 0; i < arrayOfOldTree.length; i++) {
        if (arrayOfOldTree[i].currentPath + "" == originPathParallel + "") {
            indexOfParallelOrigin = i;
            break;
        }
    }
    if (indexOfParallelOrigin == -1) {
        throw new Error("Could not find origin node")
    }
    currentIndex = indexOfParallelOrigin + 1;
    while (currentIndex < indexOfParallelOrigin + necessaryEmptyCount(arrayOfOldTree[indexOfParallelOrigin].treeElement)) {
        if (arrayOfOldTree[currentIndex].treeElement.nodeName == "parallel_branch") {
            arrayOfOldTree[currentIndex + necessaryEmptyCount(arrayOfOldTree[currentIndex].treeElement) - 1].emptyInOtherTree = true;
        }
        currentIndex += necessaryEmptyCount(arrayOfOldTree[currentIndex].treeElement);
    }
}

// If we have inserted a non "parallel_branch" node into a parallel node
function resolveParallelChildrenForInsert(arrayOfTree, pathOfParallel, indexOfNewElement) {
    let indexOfParallel = -1;
    let hadOtherNodes = false;
    let currentPathOfNewElement = JSON.parse(JSON.stringify(arrayOfTree[indexOfNewElement].currentPath));
    for (let i = 0; i < arrayOfTree.length; i++) {
        if (arrayOfTree[i].currentPath + "" == pathOfParallel + "") {
            indexOfParallel = i;
            break;
        }
    }
    if (indexOfParallel == -1 || arrayOfTree[indexOfParallel].treeElement.nodeName != "parallel" || arrayOfTree[indexOfNewElement].treeElement.nodeName == "parallel_branch") {
        return indexOfNewElement;
    }
    let currentIndex = indexOfParallel + 1;
    while (currentIndex < indexOfParallel + necessaryEmptyCount(arrayOfTree[indexOfParallel].treeElement) - 1) {
        if (indexOfNewElement != currentIndex) {
            if (arrayOfTree[currentIndex].treeElement.nodeName != "parallel_branch") {
                hadOtherNodes = true;
                break;
            }
        }
        currentIndex += necessaryEmptyCount(arrayOfTree[currentIndex].treeElement);
    }

    if (!hadOtherNodes) {
        currentIndex = indexOfParallel + 1;
        while (currentIndex < indexOfParallel + necessaryEmptyCount(arrayOfTree[indexOfParallel].treeElement) - 1) {
            if (arrayOfTree[currentIndex].treeElement.nodeName == "parallel_branch") {
                arrayOfTree[currentIndex].hasEnd = true;
                insertInArray(arrayOfTree, currentIndex + necessaryEmptyCount(arrayOfTree[currentIndex].treeElement), {
                    isStart: false,
                    hasEnd: true,
                    isEnd: true,
                    treeElement: arrayOfTree[currentIndex].treeElement,
                    originPath: JSON.parse(JSON.stringify(arrayOfTree[currentIndex].originPath)),
                    currentPath: JSON.parse(JSON.stringify(arrayOfTree[currentIndex].currentPath)),
                    colorOperations: JSON.parse(JSON.stringify(arrayOfTree[currentIndex].colorOperations)),
                    emptyInOtherTree: true
                })
                arrayOfTree[currentIndex].treeElement.setAttribute('hasEnd', 'true')
            }

            currentIndex += necessaryEmptyCount(arrayOfTree[currentIndex].treeElement);
        }
    }
    return getIndexFromArrayAccordingToPath(arrayOfTree, currentPathOfNewElement, false);
}

function insertEmptyElementInTree(emptyElement, arrayOfTree, index) {
    if (arrayOfTree[index].isEnd) {
        if (arrayOfTree[index].treeElement.nodeName == "parallel") {
            if (arrayOfTree[index - 1].treeElement.nodeName == "parallel_branch") {
                // If empty parallel branch
                arrayOfTree[index - 1].treeElement.appendChild(emptyElement);
            } else {
                arrayOfTree[index - 1].treeElement.parentNode.appendChild(emptyElement);
            }
        } else {
            arrayOfTree[index].treeElement.appendChild(emptyElement);
        }
    } else {
        if (arrayOfTree[index].treeElement.nodeName == "parallel_branch") {
            if (arrayOfTree[index - 1].treeElement.nodeName == "parallel_branch") {
                // If empty parallel branch
                arrayOfTree[index - 1].treeElement.appendChild(emptyElement);
            } else {
                arrayOfTree[index - 1].treeElement.parentNode.appendChild(emptyElement);
            }
        } else {
            arrayOfTree[index].treeElement.parentNode.insertBefore(emptyElement, arrayOfTree[index].treeElement);
        }
    }
}

function displayOneTree(divId, svgId, xmlDoc, insertsArray, deleteArray, moveOldArray, moveNewArray, updateArray) {
    return new Promise(resolve => {
        let graphrealization = new WfAdaptor($('body').attr('data-wfadaptor') + '/cockpit/themes/extended/theme.js', function (graphrealization) {

            graphrealization.draw_labels = function (max, labels, shift, striped) {
                // edit labels here
                if (divId === "#newTree") {
                    updateArray.forEach((updateValue, row) => {
                        const index = labels.findIndex(label => label['row'] === row + 1);
                        if (index != -1) {
                            var updated = {};
                            updated['column'] = 'Updated';
                            updated['value'] = updateValue;
                            labels[index]['label'].push(updated);
                        }
                    })
                    moveNewArray.forEach((movedFrom, row) => {
                        const index = labels.findIndex(label => label['row'] === row + 1);
                        if (index != -1) {
                            var moved = {};
                            moved['column'] = 'MovedFrom';
                            moved['value'] = movedFrom;
                            labels[index]['label'].push(moved);
                        }
                    })
                }


                $(svgId).css('grid-row', '1/span ' + (max.row + 2));

                if (striped == true) {
                    if (!$(divId).hasClass('striped')) {
                        $(divId).addClass('striped');
                    }
                } else {
                    $(divId).removeClass('striped');
                }

                $(svgId + '.graphlabel, ' + divId + ' .graphempty, ' + divId + ' .graphlast').remove();
                var tlabels = {};
                var tcolumns = [];
                var tcolumncount = {}
                _.each(labels, function (val) {
                    if (val.label != "") {
                        tlabels[val.row] = [];
                        _.each(val.label, function (col) {
                            if (!tcolumns.includes(col.column)) {
                                tcolumns.push(col.column);
                                tcolumncount[col.column] = 0;
                            }
                            if (col.value != undefined) {
                                tcolumncount[col.column] += 1;
                            }
                            tlabels[val.row][tcolumns.indexOf(col.column)] = {
                                label: col.value,
                                type: val.tname,
                                id: val.element_id
                            };
                        });
                    }
                });
                $(divId).css({
                    'grid-template-rows': (shift / 2) + 'px repeat(' + max.row + ', 1fr) ' + (shift / 2) + 'px',
                    'grid-template-columns': 'max-content' + (tcolumns.length > 0 ? ' repeat(' + tcolumns.length.toString() + ',max-content)' : '') + ' auto'
                });
                for (var i = 0; i < max.row; i++) {
                    for (var j = 0; j < tcolumns.length; j++) {
                        if (tlabels[i + 1] != undefined && tlabels[i + 1][j] != undefined && tlabels[i + 1][j].label != undefined && tlabels[i + 1][j].label != '') {
                            var col = tlabels[i + 1][j];
                            var ele = $('<div element-row="' + i + '" class="graphlabel ' + (i % 2 == 0 ? 'odd' : 'even') + '" element-type="' + col.type + '" element-id="' + col.id + '" style="grid-column: ' + (j + 2) + '; grid-row: ' + (i + 2) + '"><span>' + col.label + '</span></div>');
                            graphrealization.illustrator.draw.bind_event(ele, col.type, false);
                            $(divId).append(ele);
                        } else {
                            if (tcolumncount[tcolumns[j]] != 0) {
                                var ele = $('<div element-row="' + i + '" class="graphempty ' + (i % 2 == 0 ? 'odd' : 'even') + '" style="grid-column: ' + (j + 2) + '; grid-row: ' + (i + 2) + '; padding-bottom: ' + shift + 'px">&#032;</div>');
                                $(divId).append(ele);
                            }
                        }
                    }
                    var j = tcolumns.length;
                    var ele = $('<div element-row="' + i + '" class="graphlast ' + (i % 2 == 0 ? 'odd' : 'even') + '" style="grid-column: ' + (j + 2) + '; grid-row: ' + (i + 2) + '; padding-bottom: ' + shift + 'px">&#032;</div>');
                    $(divId).append(ele);
                }

                var patternOdd = $('<pattern id="diagonalHatchOdd" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(135 0 0)" width="35">\n' +
                    '  <rect x="0" y="0" height="10" style="fill:#e3e372" width="35"></rect>\n' +
                    '  <line x1="0" y1="0" x2="0" y2="10" style="stroke:#92ceec; stroke-width:35"></line>\n' +
                    '</pattern>');
                var patternEven = $('<pattern id="diagonalHatchEven" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(135 0 0)" width="35">\n' +
                    '  <rect x="0" y="0" height="10" style="fill:#cdcd67" width="35"></rect>\n' +
                    '  <line x1="0" y1="0" x2="0" y2="10" style="stroke:#7eb3cd; stroke-width:35"></line>\n' +
                    '</pattern>');

                $(svgId).prepend(patternOdd);
                $(svgId).prepend(patternEven);

                if (divId === "#newTree") {
                    for (let i = 0; i < insertsArray.length; i++) {
                        let element = $(divId).find('[element-row=' + insertsArray[i] + ']')
                        let myclass = element.last().hasClass('odd') ? "diffaddodd" : "diffaddeven";
                        $(document).find('[element-row=' + insertsArray[i] + ']').addClass(myclass);
                    }
                    for (let i = 0; i < deleteArray.length; i++) {
                        let element = $(divId).find('[element-row=' + deleteArray[i] + ']')
                        let myclass = element.last().hasClass('odd') ? "diffremoveodd" : "diffremoveeven";
                        $(document).find('[element-row=' + deleteArray[i] + ']').addClass(myclass);
                    }

                    for (let i = 0; i < moveOldArray.length; i++) {
                        let element = $(divId).find('[element-row=' + moveOldArray[i] + ']')
                        let myclass = element.last().hasClass('odd') ? "diffmoveodd" : "diffmoveeven";
                        $(document).find('[element-row=' + moveOldArray[i] + ']').addClass(myclass);
                    }

                    moveNewArray.forEach((movedFrom, row) => {
                        let element = $(divId).find('[element-row=' + row + ']')
                        let myclass = element.last().hasClass('odd') ? "diffmoveodd" : "diffmoveeven";
                        $(document).find('[element-row=' + row + ']').addClass(myclass);
                    })


                    updateArray.forEach((updateValue, row) => {
                        let element = $(divId).find('[element-row=' + row + ']')
                        let myclass = element.last().hasClass('odd') ? "diffupdateodd" : "diffupdateeven";
                        $(document).find('[element-row=' + row + ']').addClass(myclass);
                    })
                }
            };

            graphrealization.set_svg_container($(svgId));
            graphrealization.set_label_container($(divId));
            graphrealization.set_description($(xmlDoc), true);
            resolve();
        });
    });
}

function insertInArrayAccordingToPath(arrayOfTree, newPath, element) {
    const parentPath = newPath.slice(0, newPath.length - 1);
    let index = getIndexFromArrayAccordingToPath(arrayOfTree, parentPath, false);
    arrayOfTree[index].treeElement.appendChild(element)

    for (let i = 0; i < arrayOfTree.length; i++) {
        if (arrayOfTree[i].currentPath + "" == newPath + "") {
            insertXMLElementInArray(element, [], newPath, i, arrayOfTree)
            // Shift other paths one step forward
            let pathLength = newPath.length;
            for (let j = i + necessaryEmptyCount(element); j < arrayOfTree.length; j++) {
                let shouldIndexBeShifted = true;
                if (arrayOfTree[j].currentPath.length >= pathLength) {
                    for (let z = 0; z < pathLength - 1; z++) {
                        if (arrayOfTree[j].currentPath[z] != newPath[z]) {
                            shouldIndexBeShifted = false;
                            break;
                        }
                    }
                    if (shouldIndexBeShifted) {
                        arrayOfTree[j].currentPath[newPath.length - 1]++;
                    } else {
                        break;
                    }

                } else {
                    break;
                }
            }

            return i;
        } else {
            if (arrayOfTree[i].currentPath > newPath || i == arrayOfTree.length - 1) {
                let j = i;
                while (arrayOfTree[j - 1].isEnd == true) {
                    if (arrayOfTree[j - 1].currentPath.length == newPath.length) {
                        break;
                    }
                    j--;
                }
                insertXMLElementInArray(element, [], newPath, j, arrayOfTree);
                return j;

            }
            if (i == arrayOfTree.length - 1) {
                insertXMLElementInArray(element, [], newPath, i, arrayOfTree)
                return i;
            }
        }
    }
    throw new Error("Could not find path");
}

function deleteFromArrayAccordingToPath(arrayOfTree, oldPath, oldArrayOfTree) {
    let oldTreePath = [];
    for (let i = 0; i < arrayOfTree.length; i++) {
        if (arrayOfTree[i].currentPath + "" == oldPath + "") {
            let size = necessaryEmptyCount(arrayOfTree[i].treeElement);
            oldTreePath = JSON.parse(JSON.stringify(arrayOfTree[i].originPath));
            arrayOfTree[i].treeElement.remove();

            for (let j = i; j < i + size; j++) {
                // i because j will have been deleted
                deleteFromArray(arrayOfTree, i);
            }

            // Shift other paths one step backwards
            let pathLength = oldPath.length;
            for (let j = i; j < arrayOfTree.length; j++) {
                let shouldIndexBeShifted = true;
                if (arrayOfTree[j].currentPath.length >= pathLength) {
                    for (let z = 0; z < pathLength - 1; z++) {
                        if (arrayOfTree[j].currentPath[z] != oldPath[z]) {
                            shouldIndexBeShifted = false;
                            break;
                        }
                    }
                    if (shouldIndexBeShifted) {
                        arrayOfTree[j].currentPath[oldPath.length - 1]--;
                    } else {
                        break;
                    }

                } else {
                    break;
                }
            }

            break;
        }
    }

    for (let i = 0; i < oldArrayOfTree.length; i++) {
        if (oldArrayOfTree[i].originPath + "" == oldTreePath + "") {
            return i;
        }
    }

    throw new Error("Could not find the deleted element in the old tree");

}

function getIndexFromArrayAccordingToPath(arrayOfTree, oldPath, isPathFromUpdate) {
    for (let i = 0; i < arrayOfTree.length; i++) {
        if (arrayOfTree[i].currentPath + "" == oldPath + "") {
            return i;
        }
    }

    if (isPathFromUpdate) {
        for (let j = 0; j < 4; j++) {
            oldPath = oldPath.slice(0, oldPath.length - 1);

            for (let i = 0; i < arrayOfTree.length; i++) {
                if (arrayOfTree[i].currentPath + "" == oldPath + "") {
                    return i;
                }
            }
        }
    }
    throw new Error("Could not find path");
}

function xmlDocToArray(xmlDoc, arrayOfTree) {
    var children = xmlDoc.children;
    var descriptionNode;
    for (let i = 0; i < children.length; i++) {
        if (children[i].nodeName == "description") {
            descriptionNode = children[i];
            break;
        }
        if (i == children.length - 1) {
            console.error("Could not find description node under root");
        }
    }
    arrayOfTree[0] = {
        isStart: true,
        hasEnd: true,
        isEnd: false,
        treeElement: descriptionNode,
        originPath: [0],
        currentPath: [0],
        colorOperations: [],
        emptyInOtherTree: false
    }
    arrayOfTree[1] = {
        isStart: false,
        hasEnd: true,
        isEnd: true,
        treeElement: descriptionNode,
        originPath: [0],
        currentPath: [0],
        colorOperations: [],
        emptyInOtherTree: false
    }

    childrenToArray(descriptionNode, [0], 0, arrayOfTree, false);

}

function childrenToArray(rootNode, pathRootNode, indexStartRootInArray, arrayOfTree, isOriginPathEmpty) {
    let children = rootNode.children;
    // j tracks i to get index
    let j = 0;
    for (let i = 0; i < children.length; i++) {
        const newPath = Array.from(pathRootNode);
        newPath.push(i);
        switch (children[i].nodeName) {
            case "loop":
                let mode = children[i].getAttribute('mode')
                if (mode && mode == "pre_test") {
                    insertInArray(arrayOfTree, indexStartRootInArray + (j + 1), {
                        isStart: true,
                        hasEnd: false,
                        isEnd: false,
                        treeElement: children[i],
                        originPath: isOriginPathEmpty ? [] : JSON.parse(JSON.stringify(newPath)),
                        currentPath: JSON.parse(JSON.stringify(newPath)),
                        colorOperations: [],
                        emptyInOtherTree: false
                    })
                } else {
                    insertInArray(arrayOfTree, indexStartRootInArray + (j + 1), {
                        isStart: true,
                        hasEnd: true,
                        isEnd: false,
                        treeElement: children[i],
                        originPath: isOriginPathEmpty ? [] : JSON.parse(JSON.stringify(newPath)),
                        currentPath: JSON.parse(JSON.stringify(newPath)),
                        colorOperations: [],
                        emptyInOtherTree: false
                    })
                    insertInArray(arrayOfTree, indexStartRootInArray + (j + 2), {
                        isStart: false,
                        hasEnd: true,
                        isEnd: true,
                        treeElement: children[i],
                        originPath: isOriginPathEmpty ? [] : JSON.parse(JSON.stringify(newPath)),
                        currentPath: JSON.parse(JSON.stringify(newPath)),
                        colorOperations: [],
                        emptyInOtherTree: false
                    })
                }
                childrenToArray(children[i], newPath, indexStartRootInArray + (j + 1), arrayOfTree, isOriginPathEmpty);
                break;
            case "choose":
            case "parallel":
                insertInArray(arrayOfTree, indexStartRootInArray + (j + 1), {
                    isStart: true,
                    hasEnd: true,
                    isEnd: false,
                    treeElement: children[i],
                    originPath: isOriginPathEmpty ? [] : JSON.parse(JSON.stringify(newPath)),
                    currentPath: JSON.parse(JSON.stringify(newPath)),
                    colorOperations: [],
                    emptyInOtherTree: false
                })
                insertInArray(arrayOfTree, indexStartRootInArray + (j + 2), {
                    isStart: false,
                    hasEnd: true,
                    isEnd: true,
                    treeElement: children[i],
                    originPath: isOriginPathEmpty ? [] : JSON.parse(JSON.stringify(newPath)),
                    currentPath: JSON.parse(JSON.stringify(newPath)),
                    colorOperations: [],
                    emptyInOtherTree: false
                })
                childrenToArray(children[i], newPath, indexStartRootInArray + (j + 1), arrayOfTree, isOriginPathEmpty);
                break;
            case "alternative":
            case "otherwise":
            case "critical":
                insertInArray(arrayOfTree, indexStartRootInArray + (j + 1), {
                    isStart: true,
                    hasEnd: false,
                    isEnd: false,
                    treeElement: children[i],
                    originPath: isOriginPathEmpty ? [] : JSON.parse(JSON.stringify(newPath)),
                    currentPath: JSON.parse(JSON.stringify(newPath)),
                    colorOperations: [],
                    emptyInOtherTree: false
                })
                childrenToArray(children[i], newPath, indexStartRootInArray + (j + 1), arrayOfTree, isOriginPathEmpty)
                break;
            case "parallel_branch":
                let parallelOnlyHasParallelBranches = true;
                for (let z = 0; z < children.length; z++) {
                    if (children[z].nodeName != "parallel_branch") {
                        parallelOnlyHasParallelBranches = false;
                        break;
                    }
                }
                // In case root is loop
                if (rootNode.nodeName != "parallel") {
                    parallelOnlyHasParallelBranches = false;
                }
                if (parallelOnlyHasParallelBranches) {
                    insertInArray(arrayOfTree, indexStartRootInArray + (j + 1), {
                        isStart: true,
                        hasEnd: false,
                        isEnd: false,
                        treeElement: children[i],
                        originPath: isOriginPathEmpty ? [] : JSON.parse(JSON.stringify(newPath)),
                        currentPath: JSON.parse(JSON.stringify(newPath)),
                        colorOperations: [],
                        emptyInOtherTree: false
                    })
                } else {
                    children[i].setAttribute('hasEnd', 'true')
                    insertInArray(arrayOfTree, indexStartRootInArray + (j + 1), {
                        isStart: true,
                        hasEnd: true,
                        isEnd: false,
                        treeElement: children[i],
                        originPath: isOriginPathEmpty ? [] : JSON.parse(JSON.stringify(newPath)),
                        currentPath: JSON.parse(JSON.stringify(newPath)),
                        colorOperations: [],
                        emptyInOtherTree: false
                    })
                    insertInArray(arrayOfTree, indexStartRootInArray + (j + 2), {
                        isStart: false,
                        hasEnd: true,
                        isEnd: true,
                        treeElement: children[i],
                        originPath: isOriginPathEmpty ? [] : JSON.parse(JSON.stringify(newPath)),
                        currentPath: JSON.parse(JSON.stringify(newPath)),
                        colorOperations: [],
                        emptyInOtherTree: false
                    })
                }
                childrenToArray(children[i], newPath, indexStartRootInArray + (j + 1), arrayOfTree, isOriginPathEmpty);
                break;
            default:
                insertInArray(arrayOfTree, indexStartRootInArray + (j + 1), {
                    isStart: false,
                    hasEnd: false,
                    isEnd: false,
                    treeElement: children[i],
                    originPath: isOriginPathEmpty ? [] : JSON.parse(JSON.stringify(newPath)),
                    currentPath: JSON.parse(JSON.stringify(newPath)),
                    colorOperations: [],
                    emptyInOtherTree: false
                });
        }
        j += necessaryEmptyCount(children[i])
    }
}

function insertXMLElementInArray(element, originPath, currentPath, index, arrayOfTree) {
    switch (element.nodeName) {
        case "loop":
            let mode = element.getAttribute('mode')
            if (mode && mode == "pre_test") {
                insertInArray(arrayOfTree, index, {
                    isStart: true,
                    hasEnd: false,
                    isEnd: false,
                    treeElement: element,
                    originPath: JSON.parse(JSON.stringify(originPath)),
                    currentPath: JSON.parse(JSON.stringify(currentPath)),
                    colorOperations: [],
                    emptyInOtherTree: false
                })
            } else {
                insertInArray(arrayOfTree, index, {
                    isStart: true,
                    hasEnd: true,
                    isEnd: false,
                    treeElement: element,
                    originPath: JSON.parse(JSON.stringify(originPath)),
                    currentPath: JSON.parse(JSON.stringify(currentPath)),
                    colorOperations: [],
                    emptyInOtherTree: false
                })
                insertInArray(arrayOfTree, index + 1, {
                    isStart: false,
                    hasEnd: true,
                    isEnd: true,
                    treeElement: element,
                    originPath: JSON.parse(JSON.stringify(originPath)),
                    currentPath: JSON.parse(JSON.stringify(currentPath)),
                    colorOperations: [],
                    emptyInOtherTree: false
                })
            }
            childrenToArray(element, currentPath, index, arrayOfTree, true);
            break;
        case "choose":
        case "parallel":
            insertInArray(arrayOfTree, index, {
                isStart: true,
                hasEnd: true,
                isEnd: false,
                treeElement: element,
                originPath: JSON.parse(JSON.stringify(originPath)),
                currentPath: JSON.parse(JSON.stringify(currentPath)),
                colorOperations: [],
                emptyInOtherTree: false
            })
            insertInArray(arrayOfTree, index + 1, {
                isStart: false,
                hasEnd: true,
                isEnd: true,
                treeElement: element,
                originPath: JSON.parse(JSON.stringify(originPath)),
                currentPath: JSON.parse(JSON.stringify(currentPath)),
                colorOperations: [],
                emptyInOtherTree: false
            })
            childrenToArray(element, currentPath, index, arrayOfTree, true);
            break;
        case "alternative":
        case "otherwise":
        case "critical":
            insertInArray(arrayOfTree, index, {
                isStart: true,
                hasEnd: false,
                isEnd: false,
                treeElement: element,
                originPath: JSON.parse(JSON.stringify(originPath)),
                currentPath: JSON.parse(JSON.stringify(currentPath)),
                colorOperations: [],
                emptyInOtherTree: false
            })
            childrenToArray(element, currentPath, index, arrayOfTree, true);
            break;
        case "parallel_branch":
            let hasEnd = element.getAttribute('hasEnd')
            if (hasEnd && hasEnd == "true") {
                insertInArray(arrayOfTree, index, {
                    isStart: true,
                    hasEnd: true,
                    isEnd: false,
                    treeElement: element,
                    originPath: JSON.parse(JSON.stringify(originPath)),
                    currentPath: JSON.parse(JSON.stringify(currentPath)),
                    colorOperations: [],
                    emptyInOtherTree: false
                })
                insertInArray(arrayOfTree, index + 1, {
                    isStart: false,
                    hasEnd: true,
                    isEnd: true,
                    treeElement: element,
                    originPath: JSON.parse(JSON.stringify(originPath)),
                    currentPath: JSON.parse(JSON.stringify(currentPath)),
                    colorOperations: [],
                    emptyInOtherTree: false
                })
            } else {
                insertInArray(arrayOfTree, index, {
                    isStart: true,
                    hasEnd: false,
                    isEnd: false,
                    treeElement: element,
                    originPath: JSON.parse(JSON.stringify(originPath)),
                    currentPath: JSON.parse(JSON.stringify(currentPath)),
                    colorOperations: [],
                    emptyInOtherTree: false
                })
            }
            childrenToArray(element, currentPath, index, arrayOfTree, true);
            break;
        default:
            insertInArray(arrayOfTree, index, {
                isStart: false,
                hasEnd: false,
                isEnd: false,
                treeElement: element,
                originPath: JSON.parse(JSON.stringify(originPath)),
                currentPath: JSON.parse(JSON.stringify(currentPath)),
                colorOperations: [],
                emptyInOtherTree: false
            })
    }
}

function insertInArray(array, index, element) {
    if (index < 0 || index > array.length) {
        throw new Error("Index out of bounds");
    }

    // Shift elements to make space for the new element
    for (let i = array.length; i > index; i--) {
        array[i] = array[i - 1];
    }

    // Insert the new element at the specified index
    array[index] = element;
}

function deleteFromArray(array, index) {
    if (index < 0 || index >= array.length) {
        throw new Error("Index out of bounds");
    }

    // Shift elements to overwrite the removed element
    for (let i = index; i < array.length - 1; i++) {
        array[i] = array[i + 1];
    }

    // Remove the last element (now duplicated)
    array.pop();
}

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function removeCommentsFromXmlDoc(xmlDoc) {
    var comments = xmlDoc.evaluate('//comment()', xmlDoc, null, XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null);
    for (var i = 0; i < comments.snapshotLength; i++) {
        var commentNode = comments.snapshotItem(i);
        var textNode = commentNode.previousSibling;
        commentNode.parentNode.removeChild(textNode);
        commentNode.parentNode.removeChild(commentNode);
    }
}

function necessaryEmptyCount(node) {
    let count = 0;
    switch (node.nodeName) {
        case "loop":
            let mode = node.getAttribute('mode')
            if (mode && mode == "pre_test") {
                count += 1;
            } else {
                count += 2;
            }
            for (let i = 0; i < node.children.length; i++) {
                count += necessaryEmptyCount(node.children[i]);
            }
            break;
        case "choose":
        case "parallel":
            count += 2;
            for (let i = 0; i < node.children.length; i++) {
                count += necessaryEmptyCount(node.children[i]);
            }
            break;
        case "alternative":
        case "otherwise":
        case "critical":
            count += 1;
            for (let i = 0; i < node.children.length; i++) {
                count += necessaryEmptyCount(node.children[i]);
            }
            break;
        case "parallel_branch":
            let hasEnd = node.getAttribute('hasEnd')
            if (hasEnd && hasEnd == "true") {
                count += 2;
            } else {
                count += 1;
            }
            for (let i = 0; i < node.children.length; i++) {
                count += necessaryEmptyCount(node.children[i]);
            }
            break;
        default:
            count += 1;
    }
    return count;
}

