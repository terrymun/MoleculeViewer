"use strict";

// Require jQuery
var $ = require("jquery");

// Require speck-specific plugins
var Renderer = require("./renderer");
var View = require("./view");
var System = require("./system");
var xyz = require("./xyz");
var elements = require("./elements");
var presets = require("./presets");
var mimetypes = require("./mimetypes");

window.onerror = function(e, url, line) {
    console.warn("Sorry, an error has occurred:<br><br>Line #" + line + ": " + e);
}

// Some useful global shorthands
var $w = $(window),
    $d = $(document);

// Drag and drop functionality
var dnd = {
    init: function() {
        $d
        .on('dragover', '.dropzone', function(e) {
            e.preventDefault();
            e.stopPropagation();
            e.originalEvent.dataTransfer.dropEffect = 'copy';
        })
        .on('dragenter', '.dropzone', function(e) {
            e.preventDefault();
            e.stopPropagation();

            // Mark as active
            $(this).addClass('active');

            // Set progress to 0
            $(this).find('.dropzone__progress').css('width', 0);
            dnd.showMessage.call(this, '.dropzone__message.normal', false);
        })
        .on('drop', '.dropzone', function(e) {
            e.stopPropagation();
            e.preventDefault();

            // Mark as inactive
            $(this).removeClass('active');

            // Fire file upload handler
            dnd.fileHandler.call(this, e.originalEvent.dataTransfer.files);
        })

        // Fallback for people who use input[type='file']
        .on('change', '.dropzone input[type="file"]', function(e) {
            // Dropzone
            var $dz = $(this).closest('.dropzone');

            // Fire file upload handler
           dnd.fileHandler.call($dz[0], e.originalEvent.target.files);
        });
    },

    // File handler
    fileHandler: function(files) {
        var t = this,
            $t = $(t);

        // Some custom options for validation
        var opts = {
            'maxFileSize': 100 * 1024 * 1024,
            'chunkSize': 1024
        };

        // Retrieve FileList
        var f;
        if(files.length > 1) {
            dnd.showMessage.call(t, '.dropzone__message.multi', true);
            return;
        } else if(files.length === 0) {
            dnd.showMessage.call(t, '.dropzone__message.none', true);
            return;
        } else {
            f = files[0];
            if(f.size > opts.maxFileSize) {
                dnd.showMessage.call(t, '.dropzone__mesage.size', true);
                return;
            }
        }

        // Check if file type is correct
        if(!/^(text\/.*|chemical\/x-daylight-smiles)$/.test(f.type)) {
            console.warn('You have provided an invalid filetype.');
            dnd.showMessage.call(t, '.dropzone__message.invalid-filetype', true, function() {
                $(this).find('p').first().append('<br /><span class="additional-content">You have provided a file with the MIME type: <code>'+f.type+'</code></span>.');
            });
            return;
        }

        // Read file
        // We try to read in chunks to that large files can be read without issues
        var readFile = function(file, chunkSize) {
            var size = file.size,
                offset = 0,
                chunk = file.slice(offset, offset + chunkSize),
                plainText = '';
                
            var readChunk = function() {
                var reader = new FileReader();

                // When chunk is loaded
                reader.onload = function(e) {

                    // Read chunks
                    var chunkData;
                    plainText += e.target.result;

                    // Update offset for next chunk
                    offset += chunkSize;

                    // Move on to next chunk if available
                    if(offset < size) {

                        // Splice the next Blob from the File
                        chunk = file.slice(offset, offset + chunkSize);
                     
                        // Recurse to hash next chunk
                        readChunk();

                    // Done reading
                    } else {

                        // Check if file is a single string
                        plainText = $.trim(plainText)
                        if(/[\r\n]+/.test(plainText)) {
                            console.warn('You have provided a file that contains linebreaks.');
                            dnd.showMessage.call(t, '.dropzone__message.invalid-content', true);
                            return false;
                        }
                        
                        // Pass file on to success handler
                        console.log('Smiles file data:\n'+plainText);
                        smiles.parse(plainText);

                        // Finish progress
                        fileProgress.call(t, size);

                        // Remove active state
                        $t.find('.dropzone__message.normal').removeClass('active');
                    }
                };

                // Progress
                reader.onprogress = function(e) {
                    if(e.lengthComputable) {
                        fileProgress.call(t, offset + e.loaded);
                    }
                };

                // Allow users to manually abort reading
                var aborted = false;
                $d.on('keyup', function(e) {
                    if(e.which === 27 && !aborted && $(t).find('.dropzone__message.normal').hasClass('active')) {
                        reader.abort();
                        aborted = true;
                        dnd.showMessage.call(t, '.dropzone__message.aborted', true);
                        return false;
                    }
                });

                // Read file
                reader.readAsText(chunk);

            },
            fileProgress = function(offset) {
                var $p = $(this).find('.dropzone__progress'),
                    p = offset/size * 100;
                $p.css('width', p+'%');
            };

            // Start hashing chunks
            readChunk();
        };

        // Initiate file reading
        readFile(f, opts.chunkSize, null);
    },

    // Message display
    showMessage: function(target, error, callback) {
        var $t = $(this);

        $t
        .find('.dropzone__message')
            .removeClass('active')
            .end()
        .find(target)
            .addClass('active');

        // Run callback function if any
        if(typeof callback === 'function') {
            callback.call($t.find(target)[0]);
        }

        // Hide progress
        $t.find('.dropzone__progress').css('width', 0);
    }
};


// Smiles functions
var smiles = {
    // Parse Smiles
    parse: function(smile) {
        smiles
        .getXyz(smile)
        .done(function() {
            $('#speck').addClass('show');
            $('#smiles-dropzone').addClass('dropzone--collapsed');
        })
        .fail(function(jqXHR, textStatus, errorThrown) {
            console.warn('Error '+textStatus+': '+errorThrown);
            dnd.showMessage.call($('.dropzone')[0], '.dropzone__message.warning.custom', true, function() {
                $(this).empty().append('<p>Error '+textStatus+': '+errorThrown+'</p>');
            });
        });
    },

    // Get XYZ data
    getXyz: function(smile) {
        // Define variables for AJAX call
        var apiRoot = 'https://www.ebi.ac.uk/chembl/api/utils/',
            chEmblAjax = function(path) {
                return $.ajax({
                    url: apiRoot + path,
                    dataType: 'text'
                });
            };

        // Inject SMILES string
        $('#smiles-string').val(smile);

        // Make AJAX calls
        return chEmblAjax('smiles2ctab/' + btoa(smile))         // Convert Smiles to CTAB
        .then(function(ctab) {
            if(ctab) {
                console.log('CTAB file:\n\n'+ctab);
                return chEmblAjax('ctab2xyz/' + btoa(ctab))     // Convert CTAB to XYZ
            } else {
                return $.Deferred(function(d){
                    return d.reject('', 404, 'CTAB is empty, no data returned from API.');
                }).promise();
            }
        })
        .then(function(xyz) {
            if(xyz) {
                console.log('XYZ coordinates:\n\n'+xyz);
                molecule.init(xyz);
            } else {
                 return $.Deferred(function(d){
                    return d.reject('', 404, 'XYZ data is empty, no data returned from API.');
                }).promise();
            }
        });
    }
}

// Molecule view
var molecule = {
    init: function(xyzData) {
        //====================//
        // Adapted from Speck //
        //====================//
        var
            // Initialization
            system = System.new(),
            view = View.new(),
            renderContainer = $('#speck-wrapper')[0],
            imposterCanvas = $('#speck-canvas')[0],
            renderer = new Renderer(imposterCanvas, view.resolution, view.aoRes),
            needReset = false,

            // User interaction variables
            lastX = 0.0,
            lastY = 0.0,
            buttonDown = false;

        // Reflow
        var reflow = function() {
            var ww = $w.width(),
                wh = $w.height();

            var rcw = Math.round(wh * 1),
                rcm = Math.round((wh - rcw) / 2);

            $('#speck-wrapper, #speck-canvas').css({
                'width': rcw - 64,      // Make space for SMILES string
                'height': rcw - 64      // Make space for SMILES string
            });

        }
        reflow();
        window.addEventListener("resize", reflow);

        // Loop
        var loop = function() {
            if (needReset) {
                renderer.reset();
                needReset = false;
            }
            renderer.render(view);
            requestAnimationFrame(loop);
        }
        loop();

        // Bind events
        renderContainer.addEventListener("mousedown", function(e) {
            $('#speck-canvas').addClass('grabbing');
            if (e.button == 0) {
                buttonDown = true;
            }
            lastX = e.clientX;
            lastY = e.clientY;
        });

        window.addEventListener("mouseup", function(e) {
            $('#speck-canvas').removeClass('grabbing');
            if (e.button == 0) {
                buttonDown = false;
            }
        });
        setInterval(function() {
            if (!buttonDown) {
                $('#speck-canvas').removeClass('grabbing');
            }
        }, 10);

        renderContainer.addEventListener("mousemove", function(e) {
            if (!buttonDown) {
                return;
            }
            var dx = e.clientX - lastX;
            var dy = e.clientY - lastY;
            if (dx == 0 && dy == 0) {
                return;
            }
            lastX = e.clientX;
            lastY = e.clientY;
            if (e.shiftKey) {
                View.translate(view, dx, dy);
            } else {
                View.rotate(view, dx, dy);
            }
            needReset = true;
        });

        renderContainer.addEventListener("wheel", function(e) {
            var wd = 0;
            if (e.deltaY < 0) {
                wd = 1;
            }
            else {
                wd = -1;
            }

            view.zoom = view.zoom * (wd === 1 ? 1/0.9 : 0.9);
            View.resolve(view);
            needReset = true;
            e.preventDefault();
        });

        // Load structure
        var loadStructure = function(data) {
            system = System.new();
            for (var i = 0; i < data.length; i++) {
                var a = data[i];
                var x = a.position[0];
                var y = a.position[1];
                var z = a.position[2];
                System.addAtom(system, a.symbol, x,y,z);
            }
            System.center(system);
            System.calculateBonds(system);
            renderer.setSystem(system, view);
            View.center(view, system);
            needReset = true;
        }
        loadStructure(xyz(xyzData)[0]);
    }
};


// Initialize everything
window.onload = function() {
    dnd.init();

    // Other event handlers
    $d.on('click', '#smiles-data input[type="text"]', function() {
        $(this).select();
    });
}
