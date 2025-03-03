from pymem import Pymem

##修改微信版本3.9.2.23 为 3.9.11.17，打开微信后执行本脚本后，进行扫描登录

def fix_version(pm: Pymem):
    WeChatWindll_base = 0
    for m in list(pm.list_modules()):
        path = m.filename
        if path.endswith("WeChatWin.dll"):
            WeChatWindll_base = m.lpBaseOfDll
            break

    VERSION_MAPS = {
        "3.9.2.23": {
            "addrs": [0x2FFEAF8, 0x3020E1C, 0x3021AEC, 0x303C4D8, 0x303FEF4, 0x30416EC],
            "old_version": 0x63090217,  # 3.9.2.23
            "new_version": 0x63090b11   # 3.9.11.17
        },
        "3.6.0.18": {
            "addrs": [0x22300E0, 0x223D90C, 0x223D9E8, 0x2253E4C],
            "old_version": 0x63060012,  # 3.6.0.18
            "new_version": 0x63090a1b   # 3.9.10.27
        }
    }

    print("当前微信版本检测中...")
    for version_name, version_info in VERSION_MAPS.items():
        matched = True
        for offset in version_info["addrs"]:
            addr = WeChatWindll_base + offset
            try:
                v = pm.read_uint(addr)
                print(f"地址 {hex(addr)} 当前值: {hex(v)}")
                
                if v == version_info["new_version"]:
                    print("该地址已经修改过")
                    continue
                elif v != version_info["old_version"]:
                    matched = False
                    break
            except Exception as e:
                print(f"读取内存失败: {str(e)}")
                matched = False
                break

        if matched:
            print(f"检测到版本 {version_name}，开始修改...")
            for offset in version_info["addrs"]:
                addr = WeChatWindll_base + offset
                try:
                    pm.write_uint(addr, version_info["new_version"])
                    print(f"地址 {hex(addr)} 修改成功: {hex(version_info['new_version'])}")
                except Exception as e:
                    print(f"写入失败: {str(e)}")
            print("版本修改完成，可以扫码登录了")
            return

    raise Exception("当前微信版本不支持修改，仅支持 3.9.2.23 和 3.6.0.18 版本")

if __name__ == "__main__":
    try:
        print("正在查找微信进程...")
        pm = Pymem("WeChat.exe")
        print("找到微信进程，开始修改版本...")
        fix_version(pm)
    except Exception as e:
        print(f"错误: {str(e)}")
    input("按回车键退出...")