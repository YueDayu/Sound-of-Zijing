function display_seat() {
  //新清华学堂精确座位 js实现
  var tb_seat = document.getElementById("tb_Seat");
  for(var i = 0; i <= 7; i ++) {
    var row_Code = ("A").charCodeAt() + i;
    var row_Char = String.fromCharCode(row_Code);
    var tr_temp = document.createElement("tr");
    tr_temp.setAttribute("id", row_Char);
    tb_seat.appendChild(tr_temp);//添加排
    for(var j = 0; j <= 39; j ++) {//添加每排中的座位
      var td_temp = document.createElement("td");
      var td_Class;
      if(j <= 9){
        td_Class = "seat_Cannot " + i + " 0" + j;
      }else{
        td_Class = "seat_Cannot " + i + " " + j;
      }
      tr_temp.appendChild(td_temp);
      td_temp.setAttribute("class", td_Class);
    }
  }

  //综体分区座位 jquery实现
  var div_area_arrange = $("#input-area_arrange");
  for(var i = 0; i <=4; i ++) {
    var area_Code = ("A").charCodeAt() + i;
    var area_Char = String.fromCharCode(area_Code);
    var div_label = $("<div class='form-group area-label'></div>");

    var label_input = $("<label class='control-label' for='input-'+area_Char+'_area'></label>")
    label_input.text(area_Char+"区");
    div_label.append(label_input);
    div_area_arrange.append(div_label);

    var div_input = $("<div class='form-group area-input'></div>");
    var input_temp = $("<input class='form-control' type='number' id='input-A_area' value='' min='0' step='1' area-part='a'>");
    input_temp.attr("placeholder", area_Char+"区票数");
      div_input.append(input_temp);
    div_area_arrange.append(div_input);

    var div_offset = $("<div class='form-group area-offset'></div>");
    div_area_arrange.append(div_offset);
  }
}

display_seat();
