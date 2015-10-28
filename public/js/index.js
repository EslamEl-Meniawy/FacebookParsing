function getPagePosts() {
	if (!$('#page-posts-page-username').val() || $('#page-posts-page-username').val() == null || $('#page-posts-page-username').val() == '') {
		$('#page-posts').addClass('has-error');
	} else {
		var location = '/pageposts/' + $("#page-posts-page-username").val() + '/' + $("#page-posts-posts-limit").val();
		window.location = location;
	}
}
function getGroupPosts() {
	if (!$('#group-posts-group-id').val() || $('#group-posts-group-id').val() == null || $('#group-posts-group-id').val() == '') {
		$('#group-posts').addClass('has-error');
	} else {
		var location = '/groupposts/' + $("#group-posts-group-id").val() + '/' + $("#group-posts-posts-limit").val();
		window.location = location;
	}
}
function getUsersData(porg) {
	if (porg == 'page') {
		if (!$('#users-data-page-username').val() || $('#users-data-page-username').val() == null || $('#users-data-page-username').val() == '') {
			$('#users-data-page').addClass('has-error');
		} else {
			var location = '/users/username/' + $("#users-data-page-username").val();
			window.location = location;
		}
	} else if (porg == 'group') {
		if (!$('#users-data-group-id').val() || $('#users-data-group-id').val() == null || $('#users-data-group-id').val() == '') {
			$('#users-data-group').addClass('has-error');
		} else {
			var location = '/users/id/' + $("#users-data-group-id").val();
			window.location = location;
		}
	}
}
function getGroupMembers() {
	if (!$('#group-members-group-id').val() || $('#group-members-group-id').val() == null || $('#group-members-group-id').val() == '') {
		$('#group-members').addClass('has-error');
	} else {
		var location = '/groupusers/' + $("#group-members-group-id").val();
		window.location = location;
	}
}
function exportIDs(porg) {
	if (porg == 'page') {
		if (!$('#export-page-ids-page-username').val() || $('#export-page-ids-page-username').val() == null || $('#export-page-ids-page-username').val() == '') {
			$('#export-page-ids').addClass('has-error');
		} else {
			var location = '/exportids/username/' + $("#export-page-ids-page-username").val() + '/' + $("#export-page-ids-users-limit").val();
			window.location = location;
		}
	} else if (porg == 'group') {
		if (!$('#export-group-ids-group-id').val() || $('#export-group-ids-group-id').val() == null || $('#export-group-ids-group-id').val() == '') {
			$('#export-group-ids').addClass('has-error');
		} else {
			var location = '/exportids/id/' + $("#export-group-ids-group-id").val() + '/' + $("#export-group-ids-users-limit").val();
			window.location = location;
		}
	}
}
function exportFBMails(porg) {
	if (porg == 'page') {
		if (!$('#export-page-fb-mails-page-username').val() || $('#export-page-fb-mails-page-username').val() == null || $('#export-page-fb-mails-page-username').val() == '') {
			$('#export-page-fb-mails').addClass('has-error');
		} else {
			var location = '/exportfbmails/username/' + $("#export-page-fb-mails-page-username").val() + '/' + $("#export-page-fb-mails-users-limit").val();
			window.location = location;
		}
	} else if (porg == 'group') {
		if (!$('#export-group-fb-mails-group-id').val() || $('#export-group-fb-mails-group-id').val() == null || $('#export-group-fb-mails-group-id').val() == '') {
			$('#export-group-fb-mails').addClass('has-error');
		} else {
			var location = '/exportfbmails/id/' + $("#export-group-fb-mails-group-id").val() + '/' + $("#export-group-fb-mails-users-limit").val();
			window.location = location;
		}
	}
}
function getHistory (porg) {
	if (porg == 'page') {
		window.location = '/history/pages';
	} else if (porg == 'group') {
		window.location = '/history/groups';
	}
}