function generateId() {
    // used to generate Ids for user & projects
    var id = uuid.v1();
    return id;
}

function getUserId() {
    var id = null;
    if (!localStorage.userId) {
        localStorage.userId = generateId();
    }
    id = localStorage.userId;
    return id;
}

function getLastSelectedProjectPath() {
    var projectPath = "Please choose a local path";
    if (localStorage.projectPath) {
        projectPath = localStorage.projectPath;
    }
    return projectPath;
}

function setLastSelectedProjectPath(projectPath) {
    // Set to the parent of the last created project
    projectPath = projectPath.substring(0,projectPath.lastIndexOf('/'));
    localStorage.projectPath = projectPath;
}

function addProject(projName, projVersion, iconPath, projDir) {
    var id = generateId();
    var projectObj = {};
    projectObj.id = id;
    projectObj.projDir = projDir;
    projectObj.projName = projName;

    if (localStorage.projects) {
        // retrieve exsiting projects to appending a new project
        var projects = JSON.parse(localStorage.projects);
        projects.push(projectObj);
        localStorage.projects = JSON.stringify(projects);
    } else {
        var myProjects = new Array();
        myProjects.push(projectObj);
        localStorage.projects = JSON.stringify(myProjects);
    }
   
    // Store the project folder so we can access it when we toggle the server status for the newly added project.
    // The toggle will happen when the overlay animation ends to avoid janky UI (see the sidebar-handlers.js)
    // rather than here like it used to. 
    global.projDir = projDir;       
   

    // render newly added project to GUI & set it as the active widget
    addProjectWidget(id, projName, projVersion, iconPath, projDir);
    setActiveWidget(id, projDir);
}

function getProjects() {
    if (localStorage.projects) {

        var projects = JSON.parse(localStorage.projects);
        var index = 0;

        $.each(projects, function(idx, project) {
            var projDir = project.projDir;
            var id = project.id;

            fs.exists(projDir, function(exists) {
                if (exists) {
                    if (index === 0) {
                        global.firstProjectDir = projDir;
                    }
                    getProjectConfig(id, projDir, idx);
                    index++;
                } else {
                    // project folder not found...store the IDs to be removed from localStorage
                    missingId(id);
                }
            });
        });

        var removeMissingProjectsTimeout = setTimeout(removeMissingProjects, 1000);
        //var hideLoaderTimeout = setTimeout(hideLoader, 1100);
    }
}

function missingId(id) {
    global.missing.push(id);
}

function removeMissingProjects() {
    var projects = JSON.parse(localStorage.projects);
    var index = projects.length;
    var missing = global.missing;

    for (var j=0;j<missing.length;j++) {

        var currentId = missing[j];

        for (var i=0;i<index;i++) {
            var id = projects[i].id;
            if (id == currentId) {
                projects.splice(i, 1);
                index = projects.length;
                break;
            }
        }
    }

    localStorage.projects = JSON.stringify(projects);
    trackProjectsLoaded(projects.length);

    // if there are still projects remaining, set an active widget
    if (index > 0) {
        setActiveWidget(projects[0].id, projects[0].projDir);
    }
}

function getProjectConfig(id, projDir, i) {

    var oldPathToConfigFile = projDir + buildPathBasedOnOS("/www/config.xml");
    var newPathToConfigFile = projDir + buildPathBasedOnOS("/config.xml");

    fs.readFile(newPathToConfigFile, 'utf8', function(err, data) {
        if (err) {
            fs.readFile(oldPathToConfigFile, 'utf8', function(err, data) {
                if (err) {
                    console.log("config.xml not found in: " + oldPathToConfigFile + " or " + newPathToConfigFile);
                    displayErrorMessage("config.xml not found in: " + oldPathToConfigFile + " or " + newPathToConfigFile);
                } else {
                    parseConfigForRendering(data, id, projDir, i);
                }
            });
        } else {
            parseConfigForRendering(data, id, projDir, i);
        }
    });

}

function parseConfigForRendering(data, id, projDir, i) {
    console.log("parseConfigForRendering");

    $.xmlDoc = $.parseXML(data);
    $.xml = $($.xmlDoc);

    // get the project name
    var projectName = $.xml.find("name").text();

    // get the project version
    var projectVersion = $.xml.find("widget").attr("version");

    // get the app icon
    var iconPath = path.join(projDir, findIconPath($.xml.find("icon")));

    addProjectWidget(id, projectName, projectVersion, iconPath, projDir);

    if (global.firstProjectDir === projDir) {
        console.log("Toggling!")
        toggleServerStatus(projDir);
    }
}

function removeProjectById(currentId) {

    // retrieve exsiting projects to find the project to remove
    var projects = JSON.parse(localStorage.projects);
    var index = projects.length;

    for (var i=0;i<index;i++) {

        var id = projects[i].id;

        if (id == currentId) {
            projects.splice(i, 1);
            break;
        }
    }

    localStorage.projects = JSON.stringify(projects);

    index = projects.length;

    // disable the remove button
    // setting new active widget is handled once user is done removing projects
    if (index === 0) {
        disableMinusButton();
        $("#status-field").hide();
        $("#guide-add").show();
        if (global.isServerRunning) {
            setServerOffline();
        }        
        serverOfflineState();
        return;
    }

    // if remove active project, close watcher and reset global
    if (currentId === global.activeWidget.projectId) {
        global.activeWidget.watcher.close();
        global.activeWidget = undefined;
    }

}

function updateProjectNameInLocalStorage(id, projectName) {
    if (localStorage.projects) {
        var projects = JSON.parse(localStorage.projects);

        for (var i = 0; i < projects.length; i++) {
            if (id === projects[i].id) {
                projects[i].projName = projectName;
                break;
            }
        }

        localStorage.projects = JSON.stringify(projects);
    }
}
