$('input').on('ifChecked', function() {
	$('#export-multiple-ids').show();
});
$('input').on('ifUnchecked', function(event) {
	var count = 1;
	var totalCount = 0;
	$('.icheckbox_flat-blue').each(function() {
		totalCount++;
		if (!$(this).hasClass('checked')) {
			count++;
		}
	});
	if (count == totalCount) {
		$('#export-multiple-ids').hide();
	}
});
function getPagePosts(username) {
	var location = '/pageposts/' + username;
	window.location = location;
}
function getGroupPosts(id) {
	var location = '/groupposts/' + id;
	window.location = location;
}
function getUsersData(id) {
	var location = '/users/id/' + id;
	window.location = location;
}
function exportIDs (id) {
	var location = '/exportids/id/' + id;
	window.location = location;
}
function exportFBMails (id) {
	var location = '/exportfbmails/id/' + id;
	window.location = location;
}
function exportPageMultipleIDs () {
	var pageIDs = [];
	$('.icheckbox_flat-blue').each(function(index) {
		if ($(this).hasClass('checked')) {
			pageIDs.push(rarr[(index + (pageIndex * 6))].page_id);
		}
	});
	var location = '/exportmultiids/' + JSON.stringify(pageIDs);
	window.location = location;
}
function exportGroupMultipleIDs () {
	var groupIDs = [];
	$('.icheckbox_flat-blue').each(function(index) {
		if ($(this).hasClass('checked')) {
			groupIDs.push(rarr[(index + (pageIndex * 6))].group_id);
		}
	});
	var location = '/exportmultiids/' + JSON.stringify(groupIDs);
	window.location = location;
}