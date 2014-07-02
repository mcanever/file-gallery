/*global jQuery, wpActiveEditor, tinymce, WPRemoveThumbnail, file_gallery_L10n, file_gallery_options, ajaxurl, console, alert, confirm, send_to_editor, init_file_gallery */

"use strict";

var file_gallery;

var FileGallery = Ractive.extend(
{
	uploader_dragdrop: true,
	activeEditorId: null,
	upload_inside: false,
	editorBound: false,
	responseDiv: null,
	uploader: null,

	shortcodeDefaults: {},
	gallerySelected: {},
	elementCache: {},
	options: {},
	L10n: {},

	selectedItems: [],
	allItems: [],

	attachment_sortby: "menu_order, ASC",
	currentShortcode: "",
	originals: "",
	copies: "",

	tmp: 0,

	featuredImageId: window.wp !== void 0 ? wp.media.view.settings.post.featuredImageId : 0,

	singleTemplates:
	{
		_default: '<img class="align{{align}} size-{{sizeName}} wp-image-{{ID}}{{imageclass}}" src="{{sizeFile}}" alt="{{imageAltText}}" width="{{sizeWidth}}" height="{{sizeHeight}}" />',
		linked: '<a href="{{link}}"{{linkclass}}><img class="align{{align}} size-{{sizeName}} wp-image-{{ID}}{{imageclass}}" src="{{sizeFile}}" alt="{{imageAltText}}" width="{{sizeWidth}}" height="{{sizeHeight}}" /></a>',
		captioned: '[caption id="attachment_{{ID}}" align="align{{align}}" width="{{sizeWidth}}"]<img class="wp-image-{{ID}} size-{{sizeName}}{{imageclass}}" src="{{sizeFile}}" alt="{{imageAltText}}" width="{{sizeWidth}}" height="{{sizeHeight}}" />{{caption}}[/caption]',
		captionedLinked: '[caption id="attachment_{{ID}}" align="align{{align}}" width="{{sizeWidth}}"]<a href="{{link}}"{{linkclass}}><img class="wp-image-{{ID}} size-{{sizeName}}{{imageclass}}" src="{{sizeFile}}" alt="{{imageAltText}}" width="{{sizeWidth}}" height="{{sizeHeight}}" /></a>{{caption}}[/caption]'
	},

	init: function ()
	{
		var self = this;
		var list = ["id", "size", "link",
			"linkrel", "linkrel_custom", "linksize", 
			"external_url", "template", "order", 
			"orderby", "linkclass", "imageclass",
			"galleryclass", "mimetype", "limit", 
			"offset", "paginate", "columns"];
		var wpdefs = wp.media.gallery.defaults || {};
		var cache = this.elementCache;
		var galleryOptions = {};
		var len = list.length;
		var val = "";
		var j = "";
		var i = 0;

		this.options = file_gallery_options;
		this.L10n = file_gallery_L10n;
		this.responseDiv = jQuery("#file_gallery_response");
		this.shortcodeDefaults = {
			linksize: "large",
			template: "default",
			linkclass: "",
			imageclass: "",
			galleryclass: "",
			linkrel: "true",
			linkrel_custom: "",
			external_url: "",
			mimetype: "",
			tags: "",
			tags_from: "",
			limit: "",
			offset: "",
			paginate: ""
		};

		_.extend(this.shortcodeDefaults, wpdefs);

		galleryOptions = _.clone(this.shortcodeDefaults);

		// cache option elements
		for( i = 0; i < len; i++ )
		{
			val = list[i];
			cache[val] = document.getElementById("file_gallery_" + val);
			galleryOptions[val] = cache[val].value;
		}
		this.set("galleryOptions", galleryOptions);

		this.set("singleOptions", {
			size: jQuery("#file_gallery_single_size").val(),
			link: jQuery("#file_gallery_single_linkto").val(),
			external_url: jQuery("#file_gallery_single_external_url").val(),
			linkclass: jQuery("#file_gallery_single_linkclass").val(),
			imageclass: jQuery("#file_gallery_single_imageclass").val(),
			align: jQuery("#file_gallery_single_align").val(),
			caption: jQuery("#file_gallery_single_caption").prop("checked")
		});

		this.on({
			"selectAll": self.selectAll,
			"deselectAll": self.deselectAll,
			"refresh": self.refresh,
			"select": self.select,
			"setAsThumbnail": self.setAsThumbnail,
			"unsetAsThumbnail": self.unsetAsThumbnail,
			"dragenter": self.dragenter,
			"dragleave": self.dragleave,
			"edit": self.editSingle,
			"saveAttachment": self.saveAttachment,
			"cancelEditAttachment": self.cancelEditAttachment,
			"zoom": self.zoom,
			"zoomClose": self.zoomClose,
			"zoomPrev": self.zoomPrev,
			"zoomNext": self.zoomNext,
			"regenerate": self.regenerate,
			"insertGallery": self.insertGallery,
			"insertSingle": self.insertSingle,
			"changeOption": self.changeOption,
			"changeSingleOption": self.changeSingleOption,
			"fieldsetToggle": self.fieldsetToggle
		});

		this.getEditor();
		this.load();
	},

	load: function ()
	{
		var self = this;
		var post_id = jQuery("#post_ID").val();
		var singleOptions = _.clone(this.data.singleOptions);
		var galleryOptions = _.clone(this.data.galleryOptions);
		var data = {
			action: "file_gallery_init",
			post_id: post_id,
			_ajax_nonce: self.options.file_gallery_nonce
		};

		this.set("attachments", []);

		jQuery("#file_gallery").removeClass("uploader");

		jQuery.get(ajaxurl, data, function ( data )
		{
			console.log(data);

			var singleEditMode = self.data.singleEditMode;
			var attachments = data["attachments"];
			var attachmentBeingEdited = null;
			var len = attachments.length;

			if( singleEditMode )
			{
				attachmentBeingEdited = _.findWhere(attachments, {ID: self.data.attachmentBeingEdited.ID});

				if( attachmentBeingEdited === void 0 )
				{
					attachmentBeingEdited = null;
					singleEditMode = false;
				}
			}

			self.reset({
				insert_single_options_state: self.options.insert_single_options_state,
				insert_options_state: self.options.insert_options_state,
				attachmentBeingEdited: attachmentBeingEdited,
				singleEditMode: singleEditMode,
				galleryOptions: galleryOptions,
				singleOptions: singleOptions,
				mediaTags: data["mediaTags"],
				attachments: attachments,
				gallerySelected: false,
				upload_inside: false,
				actionResponse: "",
				zoomed: false,
			});

			self.do_plugins();
			self.serialize();
			self.updateShortcode();

			if( singleEditMode ) {
				self.loadAttachmentCustomFields(attachmentBeingEdited);
			}
		}, "json")
		.fail(function (data) {
			console.log("error", data.responseText);
		});
	},

	refresh: function (event)
	{
		this.load();

		event.original.preventDefault();
		return false;
	},

	ajaxGetAttachmentsById: function ( ids, callback )
	{
		var data = {
			action: "file_gallery_get_attachments_by_id",
			attachment_ids: ids,
			_ajax_nonce: this.options.file_gallery_nonce
		};

		jQuery.get(ajaxurl, data, function ( data ) {
			callback(data);
		}, "json");
	},

	insertGallery: function (event)
	{
		var editor = this.getEditor();

		if( editor ) {
			editor.fire("file_gallery_insert_gallery");
		}

		event.original.preventDefault();
		return false;
	},

	insertSingle: function (event)
	{
		var files = this.getSelectedAttachments();
		var len = files.length;

		if( len > 0 )
		{
			var f;
			var size;
			var o = this.data.singleOptions;
			var linked = (o.linkto !== "none");
			var templates = this.singleTemplates;
			var template = "";
			var output = "";
			var link = "";
			var i = 0;

			if( linked ) {
				template = o.caption ? templates.captionedLinked : templates.linked;
			}
			else if( o.caption ) {
				template = templates.captioned;
			}
			else {
				template = templates._default;
			}

			o.linkclass = o.linkclass ? ' class="' + o.linkclass + '"' : '';

			template = template.replace(/{{align}}/g, o.align)
							   .replace("{{sizeName}}", o.size)
							   .replace("{{linkclass}}", o.linkclass)
							   .replace("{{imageclass}}", o.imageclass);

			for( i; i < len; i++ )
			{
				f = files[i];
				size = f.meta.sizes[o.size] || f.meta;

				if( linked )
				{
					switch( o.linkto )
					{
						case "external_url": link = o.external_url; break;
						case "file": link = f.baseUrl + f.file; break;
						case "attachment": link = f.permalink; break;
						case "parent_post": link = f.parent_post_permalink; break;
					}
				}

				output += "\n" + template.replace(/{{ID}}/g, f.ID)
								  .replace("{{link}}", link)
								  .replace(/{{sizeWidth}}/g, size.width)
								  .replace("{{sizeHeight}}", size.height)
								  .replace("{{sizeFile}}", f.baseUrl + size.file)
								  .replace("{{imageAltText}}", f.imageAltText || f.post_title)
								  .replace(/{{caption}}/g, f.post_excerpt);
			}

			send_to_editor(output);
		}

		event.original.preventDefault();
		return false;
	},

	serialize: function ()
	{
		this.allItems = _.pluck(this.data.attachments, "ID");
		this.selectedItems = _.pluck(this.getSelectedAttachments(), "ID");
	},

	updateShortcode: function ( attrs )
	{
		attrs = attrs || this.data.galleryOptions;

		var defaults = this.shortcodeDefaults;
		var currentShortcode = "[gallery";

		_.each(attrs, function (value, key, list)
		{
			if( value !== defaults[key] ) {
				currentShortcode += " " + key + '="' + value + '"';
			}
		});

		this.currentShortcode = currentShortcode + "]";
	},

	changeOption: function (event, option)
	{
		var el = event.node;
		var value = el.value;
		var editor = this.getEditor();

		if( el.type === "checkbox" ) {
			value = el.checked;
		}

		this.set("galleryOptions." + option, value);
		this.updateShortcode();

		if( editor && this.gallerySelected[editor.id] ) {
			editor.fire("file_gallery_update_gallery");
		}
	},

	changeSingleOption: function (event, option)
	{
		var el = event.node;
		var value = el.value;

		if( el.type === "checkbox" ) {
			value = el.checked;
		}

		this.set("singleOptions." + option, value);
	},

	hasAttachments: function ()
	{
		return (this.data.attachments.length > 0);
	},

	isAnySelected: function ()
	{
		return (this.selectedItems.length > 0);
	},

	isAllSelected: function ()
	{
		var all = this.allItems;
		var selected = this.selectedItems;

		if( all.length && selected.length ) {
			return (_.difference(all, selected).length === 0);
		}

		return false;
	},

	select: function (event, attachment)
	{
		this.set("attachments." + event.index.i + ".selected", ! attachment.selected);
		this.serialize();
	},

	selectAll: function (event)
	{
		if( this.hasAttachments() && ! this.isAllSelected() )
		{
			var self = this;

			_.each(this.data.attachments, function (el, i)
			{
				if( ! el.selected ) {
					self.set("attachments." + i + ".selected", true);
				}
			});

			this.serialize();
		}

		if( event )
		{
			event.original.preventDefault();
			return false;
		}
	},

	deselectAll: function (event)
	{
		if( this.hasAttachments() && this.isAnySelected() )
		{
			var self = this;

			_.each(this.data.attachments, function (el, i)
			{
				if( el.selected ) {
					self.set("attachments." + i + ".selected", false);
				}
			});

			this.serialize();
		}

		if( event )
		{
			event.original.preventDefault();
			return false;
		}
	},

	getSelectedAttachments: function ()
	{
		return _.where(this.data.attachments, {selected: true});
	},

	getAttachmentByID: function (id)
	{
		return _.findWhere(this.data.attachments, {ID: id});
	},

	getEditor: function ()
	{
		if( window.tinymce !== void 0 )
		{
			var editor = tinymce.EditorManager.get(this.activeEditorId || window.wpActiveEditor || "content");

			if( editor )
			{
				this.activeEditorId = editor.id;
				return editor;
			}
		}

		return null;
	},

	zoom: function (event, data)
	{
		var self = this;
		var zoomed = (data !== void 0) ? data : this.get(event.keypath);
		var all = this.allItems;
		var len = all.length
		var i = all.indexOf(zoomed.ID);

		// FIX THESE!!!
			zoomed.previous = (i > 0) ? this.getAttachmentByID(all[i-1]) : false;
			zoomed.next = (i+1 !== len) ? this.getAttachmentByID(all[i+1]) : false;
		// /FIX THESE!!!

		this.set("zoomed", zoomed);

		jQuery(document).on("keyup.fileGalleryZoom", function (event)
		{
			switch( event.keyCode )
			{
				case 27: self.zoomClose(event); break; //ESC
				case 37: self.zoomPrev(event); break; // left arrow
				case 39: self.zoomNext(event); break; // right arrow
				case 69: self.editSingle(event, self.data.zoomed); break; // E
			}
		});

		if( event.original ) {
			event = event.original;
		}

		event.preventDefault();
		return false;
	},

	zoomPrev: function (event)
	{
		if( this.data.zoomed.previous ) {
			this.zoom(event, this.data.zoomed.previous);
		}

		if( event.original ) {
			event = event.original;
		}

		event.preventDefault();
		return false;
	},

	zoomNext: function (event)
	{
		if( this.data.zoomed.next ) {
			this.zoom(event, this.data.zoomed.next);
		}

		if( event.original ) {
			event = event.original;
		}

		event.preventDefault();
		return false;
	},

	zoomClose: function (event)
	{
		jQuery(document).off("keyup.fileGalleryZoom");
		this.set("zoomed", false);

		if( event.original ) {
			event = event.original;
		}

		event.preventDefault();
		return false;
	},

	regenerate: function ( event, attachments )
	{
		var self = this;
		var el = event.node;
		var data = {
			action: "file_gallery_regenerate_thumbnails",
			attachment_ids: attachments.length ? _.pluck(attachments, "ID") : [attachments.ID],
			_ajax_nonce: file_gallery_regenerate_nonce
		};

		jQuery.post(ajaxurl, data, function (response) {
			self.displayResponse(response.message);
		}, "json");

		event.original.preventDefault();
		return false;
	},

	save_menu_order: function (event, ui)
	{
		this.updateOrder(this.data.attachments, ui.item.context._ractive.index.i, ui.item.index());
		this.serialize();

		if( ! this.allItems ) {
			return false;
		}

		var self = this;
		var data = {
			action: "file_gallery_save_menu_order",
			post_id: jQuery("#post_ID").val(),
			attachment_order: this.allItems,
			_ajax_nonce: this.options.file_gallery_nonce
		};

		this.set("responseLoading", true);

		jQuery.post(ajaxurl, data, function (response) {
			self.displayResponse(response);
		}, "html");
	},

	updateOrder: function (list, oldIndex, newIndex)
	{
		var source = list[oldIndex];

		list.splice( oldIndex, 1 );
		list.splice( newIndex, 0, source);
	},

	// modified copy of WPSetAsThumbnail
	setAsThumbnail: function (event)
	{
		var self = this;
		var loader = jQuery("#file-gallery-item-" + event.context.ID).find(".thumbLoadingAnim");
		var data = {
			action: 'set-post-thumbnail',
			post_id: event.context.post_parent,
			thumbnail_id: event.context.ID,
			_ajax_nonce: file_gallery_setAsThumbnailNonce,
			cookie: encodeURIComponent( document.cookie )
		};

		this.set("responseLoading", true);
		loader.show();

		jQuery.post(ajaxurl, data, function (str)
		{
			loader.hide();

			if ( str == "0" ) {
				self.displayResponse(self.L10n.setThumbError);
			}
			else
			{
				var currentThumb = jQuery("#file_gallery_list .post_thumb");

				jQuery('a.wp-post-thumbnail').show();
				WPSetThumbnailID(event.context.ID);
				WPSetThumbnailHTML(str);

				if( currentThumb.length ) {
					self.set(currentThumb[0]._ractive.keypath + ".isPostThumb", false);
				}

				self.set(event.keypath + ".isPostThumb", true);
				self.featuredImageId = event.context.ID;
				self.displayResponse(self.L10n.post_thumb_set);
			}
		});

		event.original.preventDefault();
		return false;
	},

	unsetAsThumbnail: function (event)
	{
		jQuery("#remove-post-thumbnail").trigger("click");
		this.set(event.keypath + ".isPostThumb", false);

		event.original.preventDefault();
		return false;
	},

	removeThumbnail: function ()
	{
		var currentThumb = jQuery("#file_gallery_list .post_thumb");

		if( currentThumb.length ) {
			this.set(currentThumb[0]._ractive.keypath + ".isPostThumb", false);
		}
	},

	fieldsetToggle: function ( event, what )
	{
		what = what || "hide_gallery_options";

		var	state = 0;
		var action = "file_gallery_save_toggle_state";
		var option = "insert_options_state";

		switch( what )
		{
			case "hide_single_options":
				action = "file_gallery_save_single_toggle_state";
				option = "insert_single_options_state";
				break;
			/*case "hide_acf":
				action = "file_gallery_save_acf_toggle_state";
				option = "acf_state";
				break;*/
		}

		if( this.data[option] === 0 ) {
			state = 1;
		}

		this.set(option, state);

		jQuery.post(ajaxurl, {
			action: action,
			state: state,
			_ajax_nonce: this.options.file_gallery_nonce
		});

		event.original.preventDefault();
		return false;
	},

	dragenter: function (event)
	{
		if( this.uploader_dragdrop && ! this.data.upload_inside ) {
			this.set("upload_inside", true);
		}

		event.original.stopPropagation();
		event.original.preventDefault();
		return false;
	},

	dragleave: function (event)
	{
		var target = event.original.target;
		var container = document.getElementById("fg_container");

		if( this.uploader_dragdrop )
		{
			// http://stackoverflow.com/questions/7110353/
			if( target !== container && jQuery.contains(container, target) ) {
				// still inside container
			} else if( this.data.upload_inside ) {
				this.set("upload_inside", false);
			}
		}

		event.original.stopPropagation();
		event.original.preventDefault();
		return false;
	},

	upload_handle_error: function (error, uploader)
	{
		if( console && console.log ) {
			console.log(error);
		}
	},

	editSingle: function (event, attachment)
	{
		if( this.data.zoomed ) {
			this.zoomClose(event);
		}

		var self = this;
		var target = attachment || this.data.attachments[event.index.i];
			target.customFieldsTable = "<p>Loading attachment custom fields...</p>"; // FIXIT

		this.set("attachmentBeingEdited", target);
		this.set("singleEditMode", true);
		this.loadAttachmentCustomFields(target);
		document.getElementById("file_gallery").scrollIntoView(true);

		event.original.preventDefault();
		return false;
	},

	loadAttachmentCustomFields: function (attachment)
	{
		var self = this;
		var data = {
			action: "file_gallery_get_acf",
			post_id: attachment.ID,
			_ajax_nonce: this.options.file_gallery_nonce
		};

		jQuery.post(ajaxurl, data, function (data) {
			self.set("attachmentBeingEdited.customFieldsTable", data);
		}, "html");
	},

	getAttachmentCustomFields: function ()
	{
		var output = {};

		jQuery("#attachment_data_edit_form .custom_field textarea").each(function ()
		{
			// attachments[ID][FIELDNAME]
			var key = this.name.match(/attachments\[\d+\]\[([^\]]+)\]/)[1];
			output[key] = this.value;
		});

		return output;
	},

	saveAttachment: function ( event )
	{
		var self = this;
		var data = {
			post_id: event.context.post_parent,
			attachment_id: event.context.ID,
			action: "file_gallery_update_attachment",
			post_alt: jQuery('#file_gallery_attachment_post_alt_text').val(),
			post_title: jQuery('#file_gallery_attachment_post_title').val(),
			post_content: jQuery('#file_gallery_attachment_post_content').val(),
			post_excerpt: jQuery('#file_gallery_attachment_post_excerpt').val(),
			tax_input: jQuery('#file_gallery_attachment_tax_input').val(),
			menu_order: jQuery('#file_gallery_attachment_menu_order').val(),
			custom_fields: this.getAttachmentCustomFields(),
			_ajax_nonce: this.options.file_gallery_nonce
		};

		jQuery.post(ajaxurl, data, function (response)
		{
			self.displayResponse(response);
			self.set("singleEditMode", false);
		}, "html");

		event.original.preventDefault();
		return false;
	},

	cancelEditAttachment: function ( event )
	{
		this.set("singleEditMode", false);

		event.original.preventDefault();
		return false;
	},

	displayResponse: function (response, fade)
	{
		this.set("responseLoading", false);
		fade = (fade === void 0) ? 7000 : Number(fade);

		if( isNaN(fade) ) {
			fade = 0;
		}

		var div = this.responseDiv.children(".text");

		div.stop(true, true).css({"opacity": 0, "display": "none"});
		this.set("actionResponse", response);
		div.css({"opacity": 1, "display": "block"});

		if( fade > 0 ) {
			div.fadeOut(fade);
		}
	},

	do_plugins: function ()
	{
		var self = this;

		jQuery(".file_gallery_list").sortable(
		{
			// connectWith: ".file_gallery_list", // TODO
			placeholder: "attachment ui-selected",
			tolerance: "pointer",
			items: "li",
			opacity: 0.6,
			start: function () {},
			update: function (event, ui)
			{
				var editor = self.getEditor();

				if( this.id === "file_gallery_list" )
				{
					self.save_menu_order(event, ui);

					if( self.data.galleryAttachments.length === 0 )
					{
						self.set("galleryOptions.ids", _.pluck(self.data.attachments, "ID"));
						self.updateShortcode();

						if( editor && self.gallerySelected[editor.id] ) {
							editor.fire("file_gallery_update_gallery");
						}
					}
				}
				else if( this.id = "file_gallery_galleryAttachments" )
				{
					var list = self.data.galleryAttachments;

					self.updateOrder(list, ui.item.context._ractive.index.i, ui.item.index());
					self.set("galleryOptions.ids", _.pluck(list, "ID"));
					self.updateShortcode();

					if( editor && self.gallerySelected[editor.id] ) {
						editor.fire("file_gallery_update_gallery");
					}
				}
			}
		});

		// set up delete originals choice dialog
		jQuery("#file_gallery_delete_dialog").dialog(
		{
			autoOpen: false,
			bgiframe: true,
			resizable: false,
			modal: true,
			draggable: false,
			closeText: self.L10n.close,
			dialogClass: "wp-dialog",
			width: 600,
			close: function (event, ui)
			{
				var id = jQuery("#file_gallery_delete_dialog").data("single_delete_id");
				jQuery("#detach_or_delete_" + id + ", #detach_attachment_" + id + ",#del_attachment_" + id).fadeOut(100);
			},
			buttons: {
				"Cancel": function ()
				{
					var id = jQuery("#file_gallery_delete_dialog").data("single_delete_id");

					jQuery("#file_gallery_delete_what").val("data_only");
					jQuery("#detach_or_delete_" + id + ", #detach_attachment_" + id + ",#del_attachment_" + id).fadeOut(100);
					jQuery("#file_gallery_delete_dialog").removeData("single_delete_id");

					jQuery(this).dialog("close");
				},
				"Delete attachment data only": function ()
				{
					var message = false,
						id = "";

					if( jQuery(this).hasClass("single") )
					{
						id = jQuery("#file_gallery_delete_dialog").data("single_delete_id");
					}
					else
					{
						message = self.L10n.sure_to_delete;
						id = self.selectedItems;
					}

					jQuery("#file_gallery_delete_what").val("data_only");
					self.delete_attachments( id, message );

					jQuery(this).dialog("close");
				},
				"Delete attachment data, its copies and the files": function ()
				{
					var message = false,
						id;

					if( jQuery(this).hasClass("single") ) {
						id = jQuery("#file_gallery_delete_dialog").data("single_delete_id");
					}
					else
					{
						message = self.L10n.sure_to_delete;
						id = self.selectedItems;
					}

					jQuery("#file_gallery_delete_what").val("all");
					self.delete_attachments( id, message );

					jQuery(this).dialog("close");
				}
			}
		});

		jQuery("#file_gallery_copy_all_dialog").dialog(
		{
			autoOpen: false,
			bgiframe: true,
			resizable: false,
			modal: true,
			draggable: false,
			closeText: self.L10n.close,
			dialogClass: "wp-dialog",
			position: "center",
			width: 500,
			buttons: {
				"Cancel": function () {
					jQuery(this).dialog("close");
				},
				"Continue": function ()
				{
					var from_id = parseInt(jQuery("#file_gallery_copy_all_dialog input#file_gallery_copy_all_from").val(), 10);

					if( isNaN(from_id) || from_id === 0 )
					{
						if( isNaN(from_id) ) {
							from_id = "-none-";
						}

						alert(self.L10n.copy_from_is_nan_or_zero.replace(/%d/, from_id));

						return false;
					}

					self.copy_all_attachments(from_id);
					jQuery(this).dialog("close");
				}
			}
		});
	},

	delete_dialog: function ( id, single )
	{
		var delete_dialog = jQuery("#file_gallery_delete_dialog");
		var o = this.originals;
		var m = false;

		if( single ) {
			delete_dialog.addClass("single");
		} else {
			m = this.L10n.sure_to_delete;
		}

		if( (o !== "" && o !== void 0) || jQuery("#image-" + id).hasClass("has_copies") ) {
			delete_dialog.data("single_delete_id", id).dialog('open'); //originals present in checked list
		} else {
			this.delete_attachments(id, m);
		}

		return false;
	}
});

jQuery(document).ready(function ()
{
	if( window.typenow === "attachment" ) {
		return;
	}

	file_gallery = new FileGallery(
	{
		el: "file_gallery_inner",
		template: "#file_gallery_ractive_template",
		data: {
			actionResponse: "",
			insert_options_state: file_gallery_options.insert_options_state,
			insert_single_options_state: file_gallery_options.insert_single_options_state,
			upload_inside: false,
			singleEditMode: false,
			gallerySelected: false,
			zoomed: null,
			singleOptions: {},
			attachments: [],
			mediaTags: []
		}
	});



	/* === BINDINGS === */

	jQuery("#postimagediv").on("click", "#remove-post-thumbnail", function (event)
	{
		file_gallery.removeThumbnail();
	});



	// single attachment editing view
	jQuery("#file_gallery").on("keypress keyup", "#file_gallery_attachment_post_alt, #file_gallery_attachment_post_title, #file_gallery_attachment_post_excerpt, #file_gallery_attachment_tax_input, #file_gallery_attachment_menu_order", function (e)
	{
		if( e.which === 13 || e.keyCode === 13 ) // on enter
		{
			// Disabled. http://wordpress.org/support/topic/how-to-stop-enter-key-to-save-in-attachment-editing-screen?replies=1
			// jQuery("#file_gallery_edit_attachment_save").trigger("click");
			// e.preventDefault();
			return false;
		}
		/**
		else if( e.which === 27 || e.keyCode === 27 ) // on esc
		{
			jQuery("#file_gallery_edit_attachment_cancel").trigger("click");
		}
		/**/
	});


	jQuery("#file_gallery").on("submit", "#file_gallery_copy_all_form", function () {
		return false;
	});


	// copy all attachments from another post
	jQuery("#file_gallery").on("click", "#file_gallery_copy_all", function () {
		jQuery("#file_gallery_copy_all_dialog").dialog("open");
	});



	/* attachment edit screen */

	// acf enter on new field name
	jQuery("#file_gallery").on("keypress keyup", "#new_custom_field_key", function (e)
	{
		if( e.which === 13 || e.keyCode === 13 ) // on enter
		{
			jQuery("#file_gallery #new_custom_field_submit").trigger("click");
			e.preventDefault();
		}
	});


	/* thumbnails */

	// delete or detach single attachment link click
	jQuery("#file_gallery").on("click", "#fg_container .delete_or_detach_link", function ()
	{
		var id = jQuery(this).attr("rel"),
			a = '#detach_or_delete_' + id,
			b = '#detach_attachment_' + id,
			c = '#del_attachment_' + id;

		if( jQuery(a).is(":hidden") && jQuery(b).is(":hidden") && jQuery(c).is(":hidden") ) {
			jQuery(a).fadeIn(100);
		}
		else {
			jQuery(a + ", " + b + ", " + c).fadeOut(100);
		}

		return false;
	});

	// detach single attachment link click
	jQuery("#file_gallery").on("click", "#fg_container .do_single_detach", function ()
	{
		var id = jQuery(this).attr("rel");

		jQuery("#detach_or_delete_" + id).fadeOut(250);
		jQuery("#detach_attachment_" + id).fadeIn(100);

		return false;
	});

	// delete single attachment link click
	jQuery("#file_gallery").on("click", "#fg_container .do_single_delete", function ()
	{
		var id = jQuery(this).attr("rel");

		if( jQuery("#image-" + id).hasClass("has_copies") ) {
			return file_gallery.delete_dialog( id, true );
		}

		jQuery('#detach_or_delete_' + id).fadeOut(100);
		jQuery('#del_attachment_' + id).fadeIn(100);

		return false;
	});

	// delete single attachment link confirm
	jQuery("#file_gallery").on("click", "#fg_container .delete", function ()
	{
		var id = jQuery(this).parent("div").attr("id").replace(/del_attachment_/, "");

		if( jQuery("#image-" + id).hasClass("copy") ) {
			jQuery("#file_gallery_delete_what").val("data_only");
		}
		else {
			jQuery("#file_gallery_delete_what").val("all");
		}

		return file_gallery.delete_dialog( id, true );
	});

	// delete single attachment link confirm
	jQuery("#file_gallery").on("click", "#fg_container .detach", function () {
		return file_gallery.detach_attachments( jQuery(this).parent("div").attr("id").replace(/detach_attachment_/, ""), false );
	});

	// delete / detach single attachment link cancel
	jQuery("#file_gallery").on("click", "#fg_container .delete_cancel, #fg_container .detach_cancel",function ()
	{
		jQuery(this).parent("div").fadeOut(250);
		return false;
	});


	/* main menu buttons */

	// delete checked attachments button click
	jQuery("#file_gallery").on("click", "#file_gallery_delete_checked", function () {
		file_gallery.delete_dialog( file_gallery.selectedItems );
	});

	// detach checked attachments button click
	jQuery("#file_gallery").on("click", "#file_gallery_detach_checked", function () {
		file_gallery.detach_attachments(file_gallery.selectedItems, file_gallery.L10n.sure_to_detach);
	});




	/* other bindings */

	// tags from current post only checkbox, switch to tags button
	jQuery("#file_gallery").on("click", "#fg_gallery_tags_from", function () {
		file_gallery.serialize();
	});

	// whether to show tags or list of attachments
	jQuery("#file_gallery").on("click", "#file_gallery_switch_to_tags", function ()
	{
		file_gallery.serialize();
		file_gallery.files_or_tags();
	});

	// clickable tag links
	jQuery("#file_gallery").on("click", ".fg_insert_tag", function () {
		return file_gallery.add_remove_tags( this );
	});

	// alternative display mode, with smaller thumbs and attachment titles
	jQuery("#file_gallery").on("click", "#file_gallery_toggle_textual", function ()
	{
		jQuery("#file_gallery_list").toggleClass("textual");
		jQuery(this).prop("disabled", true);

		jQuery.post
		(
			ajaxurl,
			{
				action: "file_gallery_toggle_textual",
				state: jQuery("#file_gallery_list").hasClass("textual") ? 1 : 0,
				_ajax_nonce: file_gallery.options.file_gallery_nonce
			},
			function () {
				jQuery("#file_gallery_toggle_textual").prop("disabled", false);
			}
		);
	});

	jQuery("body").on("click", ".media-frame .media-frame-content .attachment", function ()
	{
		jQuery(".file-gallery-response").hide();
	});

	wp.media.view.Modal.prototype.on("close", function ()
	{
		//file_gallery.tinymce_deselect( true );
		file_gallery.load();
	});
});


// --------------------------------------------------------- //


// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/indexOf
if (!Array.prototype.indexOf) {
Array.prototype.indexOf = function (searchElement, fromIndex) {
  if ( this === undefined || this === null ) {
    throw new TypeError( '"this" is null or not defined' );
  }
  var length = this.length >>> 0; // Hack to convert object.length to a UInt32
  fromIndex = +fromIndex || 0;
  if (Math.abs(fromIndex) === Infinity) {
    fromIndex = 0;
  }
  if (fromIndex < 0) {
    fromIndex += length;
    if (fromIndex < 0) {
      fromIndex = 0;
    }
  }
  for (;fromIndex < length; fromIndex++) {
    if (this[fromIndex] === searchElement) {
      return fromIndex;
    }
  }
  return -1;
};
}

// thanks to http://phpjs.org/functions/strip_tags:535
function strip_tags(input, allowed)
{
	"use strict";
	// making sure the allowed arg is a string containing only tags in lowercase (<a><b><c>)
	allowed = (((allowed || "") + "").toLowerCase().match(/<[a-z][a-z0-9]*>/g) || []).join('');
	var tags = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, commentsAndPhpTags = /<!--[\s\S]*?-->|<\?(?:php)?[\s\S]*?\?>/gi;
	return input.replace(commentsAndPhpTags, '').replace(tags, function($0, $1)	{
		return allowed.indexOf('<' + $1.toLowerCase() + '>') > -1 ? $0 : '';
	});
}
