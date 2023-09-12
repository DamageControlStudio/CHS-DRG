const sqlPromise = initSqlJs({locateFile: file => `./static/sql-wasm.wasm`});
var db = undefined;
let abortController = null;
$("#display").hide();

async function loadDatabase() {
    if (db == undefined) {
        const start = new Date().getTime();
        const dataPromise = fetch("./static/CHS-DRG.db").then(res => res.arrayBuffer());
        const [SQL, buf] = await Promise.all([sqlPromise, dataPromise]);
        db = new SQL.Database(new Uint8Array(buf));
        const end = new Date().getTime();
        console.log("CHS-DRG.db 加载完成：", (end-start)/1000, "s");
        $("#search_text").removeAttr("placeholder");
        $("#search_text").removeAttr("disabled");
    }
}
loadDatabase();

function findoutWeights(adrg) {
    // weights 是字典，可直接使用
    let relative_groupnames = Object.keys(weights).filter((groupname) => groupname.slice(0, 3) == adrg);
    var weight_label = '<div class="field is-grouped is-grouped-multiline">';
    relative_groupnames.map(
        function(item) {
            weight_label += '<div class="control"><div class="tags has-addons"><span class="tag">' + item + '</span><span class="tag is-info">' + weights[item] + "</span></div></div>";
        }
    );
    weight_label += '</div>';
    return weight_label;
}

function parseResult(result) {
    var resultHtml = "";
    if(result[0]!=undefined && $("#search_text").val()!="") {
        const l = result[0].values.length;
        console.log("检索到", l, "条结果"); // 应该展示在网页中
        for(let i = 0; i < l; i++) {
            resultHtml += "<tr><td>";
            resultHtml += result[0].values[i][0];
            resultHtml += "</td><td>";
            resultHtml += result[0].values[i][1];
            resultHtml += "</td><td>";
            resultHtml += '<a href="./static/adrg/' + result[0].values[i][2] + '.html" target="_blank">' + result[0].values[i][2] + '</a>';
            resultHtml += "</td><td>";
            resultHtml += findoutWeights(result[0].values[i][2]);
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
            ":limit": 128,
        };
        var stmt = "";
        if (obscure) {
            stmt = `SELECT code, name, adrg FROM operation WHERE name LIKE :obscureword 
                            UNION SELECT code, name, adrg FROM diagnose WHERE name LIKE :obscureword 
                            LIMIT :limit;`;
        } else {
            stmt = `SELECT code, name, adrg FROM operation WHERE name = :keyword 
                            UNION SELECT code, name, adrg FROM diagnose WHERE name = :keyword 
                            LIMIT :limit;`;
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

$("#search_text").on("input", function (e) {
    readyToSearch();
});

$("input[name='search_mode']").on("click", function () {
    readyToSearch();
});