const sqlPromise = initSqlJs({ locateFile: file => `./static/sql-wasm.wasm` });
var db = undefined;
let abortController = null;


async function loadDatabase() {
    if (db == undefined) {
        const start = new Date().getTime();
        const dataPromise = fetch("./static/CHS-DRG.frontend.db").then(res => res.arrayBuffer());
        const [SQL, buf] = await Promise.all([sqlPromise, dataPromise]);
        db = new SQL.Database(new Uint8Array(buf));
        const end = new Date().getTime();
        console.log("数据库加载完成：", (end - start) / 1000, "s");
        $("#search_text").removeAttr("placeholder");
        $("#search_text").removeAttr("disabled");
    }
}
loadDatabase();


function findoutWeights(adrg) {
    if (adrg) {
        // weights 是字典，可直接使用
        let relative_groupnames = Object.keys(weights).filter((groupname) => groupname.slice(0, 3) == adrg);
        var weight_label = '<div class="field is-grouped is-grouped-multiline">';
        relative_groupnames.map(
            function (item) {
                weight_label += '<div onclick="addMessage(\'' + item + '\')" class="control"><div class="tags has-addons"><span class="tag">';
                weight_label += item + '</span><span class="tag is-info">';
                weight_label += weights[item] + "</span></div></div>";
            }
        );
        weight_label += '</div>';
        return weight_label;
    } else {
        return ""
    }

}

function parseResult(result) {
    var resultHtml = "";
    if (result[0] != undefined && $("#search_text").val() != "") {
        const l = result[0].values.length;
        console.log("检索到", l, "条结果"); // 应该展示在网页中
        for (let i = 0; i < l; i++) {
            thecode = result[0].values[i][0];
            thename = result[0].values[i][1];
            adrg = result[0].values[i][2];
            cc = result[0].values[i][3];
            mcc = result[0].values[i][4];
            ex = result[0].values[i][5];
            resultHtml += "<tr><td>";
            resultHtml += thecode;
            resultHtml += "</td><td>";
            resultHtml += thename;
            resultHtml += "</td><td>";
            if (adrg != null) {
                resultHtml += '<a href="./static/adrg/' + adrg + '.html" target="_blank" class="control"><div class="tags has-addons"><span class="tag is-success">' + adrg + '</span></div></a>';
            } else {
                resultHtml += "";
            }
            resultHtml += "</td><td>";
            resultHtml += findoutWeights(adrg);
            resultHtml += "</td><td>";
            if (cc == 1 && mcc == 1) {
                console.log("数据出错：不可能同时为CC和MCC");
            } else if (cc == 1) {
                resultHtml += '<a href="./static/ex/T' + ex + '.html" target="_blank"><span class="tag is-warning">CC</span></a>';
            } else if (mcc == 1) {
                resultHtml += '<a href="./static/ex/T' + ex + '.html" target="_blank"><span class="tag is-danger">MCC</span></a>';
            }
            resultHtml += "</td></tr>";
        }
        $("#display").show();
    } else {
        $("#display").hide();
    }
    $("#results").html(resultHtml);
}

const search = async (abortSignal, keyword, obscure) => {
    return new Promise(async (resolve, reject) => {
        const error = new DOMException("Search aborted by the user", "AbortError");
        if (abortSignal.aborted) {
            return reject(error);
        }
        const kv = {
            ":keyword": keyword,
            ":obscureword": "%" + keyword + "%",
            ":limit": 256,
        };
        var stmt = "";
        if (obscure) {
            stmt = `SELECT code, name, adrg, cc, mcc, ex FROM drg WHERE name LIKE :obscureword LIMIT :limit;`;
        } else {
            stmt = `SELECT code, name, adrg, cc, mcc, ex FROM drg WHERE name = :keyword LIMIT :limit;`;
        }
        const result = db.exec(stmt, kv);
        parseResult(result);

        abortSignal.addEventListener("abort", () => {
            clearTimeout(timeout);
            reject(error);
        });
    });
};

function readyToSearch() {
    if (abortController) {
        abortController.abort();
        abortController = null;
        return;
    }
    abortController = new AbortController();
    try {
        var keyword = $("#search_text").val();
        var obscure = true;
        if ($("input[name='search_mode']").get(0).checked) {
            obscure = false;
        }
        search(abortController.signal, keyword, obscure);
    } catch {

    } finally {
        abortController = null;
    }
}

function financial(x) {
    return Number.parseFloat(x).toFixed(2);
  }
  
function addMessage(drg_group) {
    if($("#" + drg_group).length == 0) {
        var currentMessages = $("#messages").html();
        var drgMessage = "【" + drg_group + "】";
        let fee1 = weights[drg_group] * rates["职工"];
        let fee2 = weights[drg_group] * rates["居民"];
        drgMessage += " 职工 " + financial(fee1) + " 职工低倍 " + financial(fee1 * 0.4);
        drgMessage += " | 居民 " + financial(fee2) + " 居民低倍 " + financial(fee2 * 0.4);
        currentMessages += '<div id="' + drg_group + '" class="notification is-warning"><button onclick="deleteMessage(\''+ drg_group + '\')" class="delete"></button>' + drgMessage + '</div>';
        $("#messages").html(currentMessages);
    }
}

function deleteMessage(drg_group) {
    $("[id^='" + drg_group + "']").remove();
}

$("#search_text").on("input", function (e) {
    readyToSearch();
});

$("input[name='search_mode']").on("click", function () {
    readyToSearch();
});
