import UIKit
import Capacitor

class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(PiyoPlugin())
    }

    #if DEBUG
    // シミュレーターでの確認用。起動引数 -piyoE2E の時だけ、プラグインを順に呼んで結果をログに出す
    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        guard ProcessInfo.processInfo.arguments.contains("-piyoE2E") else { return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 4) { [weak self] in
            let js = """
            (async()=>{const P=window.Capacitor.Plugins.Piyo;const r={};const put=()=>{window.__e2e=JSON.stringify(r)};
            r.native=window.Capacitor.isNativePlatform();r.booted=!!window.__miniReady;r.plugin=!!P;put();
            const d=new Date();const k=d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();
            P.dailySteps({from:k}).then(x=>{r.days=x.days;put()}).catch(e=>{r.daysErr=e.message;put()});
            P.productPrice().then(x=>{r.price=x.price;put()}).catch(e=>{r.priceErr=e.message;put()});
            P.entitled().then(x=>{r.owned=x.owned;put()}).catch(e=>{r.ownedErr=e.message;put()});
            P.pushWidget({name:'もも',image:'piyo_child.webp',hunger:40,mood:70,away:false,at:Date.now()}).then(()=>{r.widget=true;put()}).catch(e=>{r.widgetErr=e.message;put()});
            P.scheduleHungry({at:Date.now()+3600000,name:'もも'}).then(()=>{r.notify=true;put()}).catch(e=>{r.notifyErr=e.message;put()});
            })().catch(e=>{window.__e2e='ERR '+e.message});
            """
            self?.webView?.evaluateJavaScript(js + ";0", completionHandler: nil)
            DispatchQueue.main.asyncAfter(deadline: .now() + 6) {
                self?.webView?.evaluateJavaScript("window.__e2e") { value, _ in
                    NSLog("PIYO_E2E %@", String(describing: value))
                    let url = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("e2e.json")
                    try? String(describing: value).write(to: url, atomically: true, encoding: .utf8)
                }
            }
        }
    }
    #endif
}
