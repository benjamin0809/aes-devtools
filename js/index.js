	function decrypt_pcc() {
        var key = $("#key").val();
        var ivKey = $("#ivKey").val();
        var oldV = $("#oldv").val();
        if (!key) {
        	alert("秘钥不能为空！");
        	return;
        }
        if (!oldV) {
        	alert("密文不能为空！");
        	return;
        }
        var newV = Decrypt(oldV, key, ivKey);
		localStorage.setItem("jsonObj", newV);
    }

	//解密方法
    function Decrypt(dataValue, keyValue, ivValue) {
        var keyStr = CryptoJS.enc.Utf8.parse(keyValue);
        var decrypt = "";
        if (ivKey) {
            var ivStr = CryptoJS.enc.Utf8.parse(ivValue);
            decrypt = CryptoJS.AES.decrypt(dataValue, keyStr, {mode: CryptoJS.mode.CBC, iv: ivStr, padding: CryptoJS.pad.Pkcs7});
        } else {
            decrypt = CryptoJS.AES.decrypt(dataValue, keyStr, {mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7});
        }
        return CryptoJS.enc.Utf8.stringify(decrypt).toString();
    }