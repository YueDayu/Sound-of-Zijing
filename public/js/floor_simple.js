
var ticketLeft = new Object();
ticketLeft.A = 1;
ticketLeft.B = 0;
ticketLeft.C = 3;
ticketLeft.D = 5;
ticketLeft.E = 7;
var stateCode = 0;
var maxtickets = 3;
var all_selected_tickets_count = 0;

$(document).ready(function() {
	//渲染界面数据和图片
	$('#book_time').html(book_time);


	//显示票数
	$("#block_A a").html("A区(" + ticketLeft.A + ")");
	$("#block_B a").html("B区(" + ticketLeft.B + ")");
	$("#block_C a").html("C区(" + ticketLeft.C + ")");
	$("#block_D a").html("D区(" + ticketLeft.D + ")");
	$("#block_E a").html("E区(" + ticketLeft.E + ")");



	//区域票数
	ticketNum = new Array();
	ticketNum = [ticketLeft.A,  ticketLeft.B, ticketLeft.C, ticketLeft.D, ticketLeft.E]
	//区域标识
	blockSign = new Array();
	blockSign = ["A", "B", "C", "D", "E"]
	//无票的选区
	for (i = 0; i < 5; i++){
		$("#block_" + blockSign[i]).children("[id^=area]").css("background-color", "#6fd9d9");
		if (ticketNum[i] == 0) {
			$("#block_" + blockSign[i]).css("border-color", "#F22121");
			$("#block_" + blockSign[i]).css("background", "#930202");
			$("#block_" + blockSign[i]).children("[id^=area]").css("background", "#F22121");	
		}
		a = $("#block_" + blockSign[i] + " a");
		left = 0.5*(a.parent().width() - a.width());
		a.css("left", left);
	}
	switch (stateCode){
		case 1: alertInfo("你选择的区域已满<br>请重新选座");
				break;
		case 2: alertInfo("选座超时<br>请重新选座");
				break;
		default: alertInfo("未连入wifi,网页已切入极速版");
				break;
	}
	//渲染结束
});


$("#choose").find("a").click(function() {
	var selected_tickets_count = $(this).parent().val();
	var selected_area = $(this).parent().attr('id').substring(0,1);
	var ticket_left;
	switch(selected_area){
		case "A":
			ticket_left = ticketLeft.A;
			break;
		case "B":
			ticket_left = ticketLeft.B;
			break;
		case "C":
			ticket_left = ticketLeft.C;
			break;
		case "D":
			ticket_left = ticketLeft.D;
			break;
		case "E":
			ticket_left = ticketLeft.E;
			break;
	}

	if(($(this).attr('id')).substring(0,4) == "plus"){
		if(maxtickets == all_selected_tickets_count) {
			alertInfo("您已经选完座位了");
			return;
		}
		if((ticket_left > selected_tickets_count)) {
			selected_tickets_count = selected_tickets_count + 1;
			all_selected_tickets_count = all_selected_tickets_count + 1;
		}
		else
			alertInfo("所选区域已满<br>请选择其他区域");
		$(this).parent().val(selected_tickets_count);
		$(this).next().val(selected_tickets_count);
	}
	else{
		if(selected_tickets_count > 0)
			selected_tickets_count = selected_tickets_count - 1;
		if(all_selected_tickets_count > 0)all_selected_tickets_count = all_selected_tickets_count - 1;
		$(this).parent().val(selected_tickets_count);
		$(this).prev().val(selected_tickets_count);
	}
})

//提交按钮的点击事件
$("#buttom_frame").click(function(){
	var url = window.location.href;
	if (selected != 0){
		$("#submitArea").html('<form name=myForm><input type=hidden name=ticket_id><input type=hidden name=seat><input type=hidden name=stateCode></form>');
	    var myForm=document.forms['myForm'];
	    myForm.action=url;
	    myForm.method='POST';
	    myForm.ticket_id.value=ticket_id;
	    myForm.seat.value=$("#seat_info").html();
	    myForm.stateCode.value = stateCode;
	    myForm.submit();
	}
	else
		alertInfo("你还未选择任何座位");
})


//提示框
function alertInfo(info){
	$("#alertInfo").html(info);
	$("#alertFrame").css("display", "inherit");
	$("#alertFrame").animate({
		top: '40%',
		opacity: '.9',
	}, 1000, function(){
		setTimeout(function(){
			$("#alertFrame").animate({
				top: '25%',
				opacity: '0',
			}, 600, function(){
				$("#alertFrame").css("display", "none");
			})
		}, 1500);
	});
}
