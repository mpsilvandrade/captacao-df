const SISTEMA_URL='https://mpsilvandrade.github.io/captacao-df/';
const KEY_P='captdf_prosps',KEY_PR='captdf_props',KEY_IDX='captdf_idx';

// ===== GOOGLE SHEETS =====
// Cole aqui a URL gerada ao implantar o Apps Script
const SHEETS_URL='https://script.google.com/macros/s/AKfycbxyInSEOAkr8oS1f8jeJIdZapBflNbeFMeqPXnQ_KAdM7ikxMn7N9EhVyyhUaLM-o55NA/exec';

function enviarParaSheets(dados){
  if(!SHEETS_URL||SHEETS_URL.startsWith('COLE'))return;
  const form=new FormData();
  form.append('data', JSON.stringify(dados));
  fetch(SHEETS_URL,{method:'POST',body:form,mode:'no-cors'}).catch(()=>{});
}
const $=id=>document.getElementById(id);

let dadosExtraidos=null;
let telsState=[];   // array de {numero, whatsapp, funciona}
let endSelecionado='';
let imovelMatchId=null;

function setStatus(msg,tipo){const el=$('status');el.textContent=msg;el.className='status '+(tipo||'');}

// ===== RENDERIZAR TELEFONES =====
function renderTels(tels){
  telsState=tels.map(t=>({...t}));
  const container=$('tel-list');
  container.innerHTML='';

  if(!tels||tels.length===0){
    container.innerHTML='<div class="empty-msg">Nenhum telefone encontrado</div>';
    return;
  }

  tels.forEach((tel,i)=>{
    const div=document.createElement('div');
    div.className='tel-item';
    div.id='tel-item-'+i;
    div.innerHTML=`
      <input type="checkbox" class="chk-funciona" id="chk-${i}" title="Marcar como funciona">
      <span class="tel-num">${tel.numero}</span>
      ${tel.whatsapp?'<span class="tag-wpp">WhatsApp</span>':''}
      <span class="tag-funciona">✓ Funciona</span>
    `;
    div.querySelector('.chk-funciona').addEventListener('change',e=>{
      telsState[i].funciona=e.target.checked;
      div.classList.toggle('funciona',e.target.checked);
    });
    container.appendChild(div);
  });
}

// ===== RENDERIZAR ENDEREÇOS =====
function renderEnderecos(enderecos, prosps){
  const container=$('end-list');
  container.innerHTML='';
  endSelecionado='';
  imovelMatchId=null;

  if(!enderecos||enderecos.length===0){
    container.innerHTML='<div class="empty-msg">Nenhum endereço encontrado</div>';
    return;
  }

  enderecos.forEach((end,i)=>{
    // Match com imóveis cadastrados
    const match=prosps.find(p=>{
      if(!p.end)return false;
      const a=p.end.toLowerCase().replace(/\s+/g,' ');
      const b=end.toLowerCase().replace(/\s+/g,' ');
      const wordsA=a.split(/\W+/).filter(w=>w.length>3);
      const wordsB=b.split(/\W+/).filter(w=>w.length>3);
      return wordsA.filter(w=>wordsB.includes(w)).length>=2;
    });

    const div=document.createElement('div');
    div.className='end-item'+(match?' match':'');
    div.id='end-item-'+i;
    div.innerHTML=`
      <span class="end-txt">${end}</span>
      ${match?`<span class="tag-match">✓ ${match.cod}</span>`:''}
      <span class="tag-sel">✓ Selecionado</span>
    `;
    div.addEventListener('click',()=>{
      // Desselecionar todos
      document.querySelectorAll('.end-item').forEach(el=>el.classList.remove('selecionado'));
      div.classList.add('selecionado');
      endSelecionado=end;
      if(match){
        $('p-imovel').value=match.id;
        imovelMatchId=match.id;
      }
    });
    container.appendChild(div);

    // Auto-selecionar o primeiro com match
    if(match&&!endSelecionado){
      setTimeout(()=>div.click(),150);
    }
  });
}

// ===== PREENCHER PROPRIETÁRIO =====
function preencherProprietario(d){
  $('p-nome').value=d.nome||'';
  $('p-cpf').value=d.cpf||'';
  $('p-idade').value=d.idade||'';
  $('p-email').value=d.email||'';

  renderTels(d.tels||[]);

  // Carregar imóveis do sistema para match de endereço
  chrome.tabs.query({},tabs=>{
    const tab=tabs.find(t=>t.url&&t.url.startsWith(SISTEMA_URL));
    if(tab){
      chrome.scripting.executeScript({
        target:{tabId:tab.id},
        func:(KEY_P)=>JSON.parse(localStorage.getItem(KEY_P)||'[]').map(p=>({id:p.id,cod:p.cod,end:p.end})),
        args:[KEY_P]
      },results=>{
        const prosps=(results&&results[0]&&results[0].result)||[];
        // Popular select
        const sel=$('p-imovel');
        sel.innerHTML='<option value="">Selecione...</option>';
        prosps.forEach(p=>{
          const o=document.createElement('option');
          o.value=p.id;
          o.textContent=(p.cod||p.id)+' – '+(p.end||'').substring(0,38);
          sel.appendChild(o);
        });
        renderEnderecos(d.enderecos||[],prosps);
      });
    } else {
      renderEnderecos(d.enderecos||[],[]);
    }
  });
}

// ===== PREENCHER IMÓVEL =====
function preencherImovel(d){
  $('f-end').value=d.endereco||'';
  $('f-reg').value=d.regiao||'';
  $('f-val').value=d.valor||'';
  $('f-area').value=d.area||'';
  $('f-qts').value=d.quartos||'';
  $('f-gar').value=d.garagem||'';
  $('f-cond').value=d.condominio||'';
  $('f-m2').value=d.valorM2||'';
  $('f-elev').value=d.elevador==='Sim'?'Sim':d.elevador==='Não'?'Não':'Não informado';
  const low=(d.titulo||d.link||'').toLowerCase();
  $('f-tipo').value=/casa/.test(low)?'Casa':/terreno|lote/.test(low)?'Terreno':/sala|comercial/.test(low)?'Sala comercial':/kitnet/.test(low)?'Kitnet':'Apartamento';
  $('f-fin').value=/aluguel|alugar/.test(d.link||'')?'Aluguel':'Venda';
  $('f-cod').textContent=d.codigo||'—';
}

// ===== SALVAR IMÓVEL =====
function salvarImovel(){
  const end=$('f-end').value.trim();
  if(!end){setStatus('Informe o endereço.','err');return;}
  const f={
    cod:$('f-cod').textContent!=='—'?$('f-cod').textContent:'',
    reg:$('f-reg').value.trim(),end,
    tipo:$('f-tipo').value,fin:$('f-fin').value,
    val:$('f-val').value.trim(),area:$('f-area').value.trim(),
    qts:$('f-qts').value.trim(),gar:$('f-gar').value.trim(),
    elev:$('f-elev').value,cond:$('f-cond').value.trim(),
    m2:$('f-m2').value.trim(),
    link:dadosExtraidos?dadosExtraidos.url:'',
    obs:'',origem:'extensao',
  };
  setStatus('Salvando...','loading');
  injetarNaSistema((tabId)=>{
    chrome.scripting.executeScript({
      target:{tabId},
      func:(dados,KEY_P,KEY_IDX)=>{
        try{
          let prosps=JSON.parse(localStorage.getItem(KEY_P)||'[]');
          let idx=JSON.parse(localStorage.getItem(KEY_IDX)||'{"p":1,"pr":1,"c":1}');
          if(prosps.find(p=>p.end&&p.end.toLowerCase()===(dados.end||'').toLowerCase()))
            return{ok:false,msg:'duplicata'};
          const cod=dados.cod||('IMV-'+String(idx.p).padStart(3,'0'));
          prosps.push({id:idx.p++,cod,...dados,data:new Date().toISOString().split('T')[0]});
          localStorage.setItem(KEY_P,JSON.stringify(prosps));
          localStorage.setItem(KEY_IDX,JSON.stringify(idx));
          window.dispatchEvent(new CustomEvent('captacaoDF_novo',{detail:{cod}}));
          return{ok:true,cod};
        }catch(e){return{ok:false,msg:e.message};}
      },
      args:[f,KEY_P,KEY_IDX]
    },results=>{
      const res=results&&results[0]&&results[0].result;
      if(res&&res.ok){
        $('saved-msg-im').style.display='block';
        $('btn-save-im').disabled=true;
        setStatus('✓ Imóvel salvo! Cód: '+res.cod,'ok');
        // Sincronizar com Google Sheets
        enviarParaSheets({tipo:'imovel',...f,tipo_imovel:f.tipo,cod:res.cod,data:new Date().toISOString().split('T')[0]});
      } else {
        setStatus(res&&res.msg==='duplicata'?'⚠ Endereço já cadastrado':'Erro ao salvar.','err');
      }
    });
  });
}

// ===== SALVAR PROPRIETÁRIO =====
function salvarProprietario(){
  const nome=$('p-nome').value.trim();
  if(!nome){setStatus('Informe o nome.','err');return;}

  const telsFuncionam=telsState.filter(t=>t.funciona).map(t=>t.numero);
  const todosNumeros=telsState.map(t=>t.numero);
  const wppNums=telsState.filter(t=>t.whatsapp).map(t=>t.numero);

  const f={
    nome,
    doc:$('p-cpf').value.trim(),
    idade:$('p-idade').value.trim(),
    email:$('p-email').value.trim(),
    tipo:'Pessoa física',
    tel:telsFuncionam[0]||todosNumeros[0]||'',
    tel2:telsFuncionam[1]||todosNumeros[1]||'',
    tel3:telsFuncionam[2]||todosNumeros[2]||'',
    todosOsTelefones:telsState,
    whatsappNums:wppNums,
    telsFuncionam,
    imovelId:$('p-imovel').value?Number($('p-imovel').value):null,
    statusContato:$('p-status').value,
    enderecoEemovel:endSelecionado,
    obs:'',
  };

  setStatus('Salvando proprietário...','loading');
  injetarNaSistema((tabId)=>{
    chrome.scripting.executeScript({
      target:{tabId},
      func:(dados,KEY_PR,KEY_IDX)=>{
        try{
          let props=JSON.parse(localStorage.getItem(KEY_PR)||'[]');
          let idx=JSON.parse(localStorage.getItem(KEY_IDX)||'{"p":1,"pr":1,"c":1}');
          props.push({id:idx.pr++,...dados});
          localStorage.setItem(KEY_PR,JSON.stringify(props));
          localStorage.setItem(KEY_IDX,JSON.stringify(idx));
          window.dispatchEvent(new CustomEvent('captacaoDF_prop',{detail:{nome:dados.nome}}));
          return{ok:true};
        }catch(e){return{ok:false,msg:e.message};}
      },
      args:[f,KEY_PR,KEY_IDX]
    },results=>{
      const res=results&&results[0]&&results[0].result;
      if(res&&res.ok){
        $('saved-msg-prop').style.display='block';
        $('btn-save-prop').disabled=true;
        setStatus('✓ Proprietário salvo!','ok');
        // Sincronizar com Google Sheets
        enviarParaSheets({tipo:'proprietario',...f,tipo_pessoa:f.tipo});
      } else {
        setStatus('Erro ao salvar.','err');
      }
    });
  });
}

// ===== HELPER: abrir/usar aba do sistema =====
function injetarNaSistema(cb){
  chrome.tabs.query({},tabs=>{
    const tab=tabs.find(t=>t.url&&t.url.startsWith(SISTEMA_URL));
    if(tab){cb(tab.id);}
    else{
      chrome.tabs.create({url:SISTEMA_URL},newTab=>{
        const l=(tabId,info)=>{
          if(tabId===newTab.id&&info.status==='complete'){
            chrome.tabs.onUpdated.removeListener(l);
            setTimeout(()=>cb(newTab.id),800);
          }
        };
        chrome.tabs.onUpdated.addListener(l);
      });
    }
  });
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded',()=>{
  $('btn-extract').addEventListener('click',()=>{
    $('btn-extract').disabled=true;
    setStatus('Lendo a página...','loading');
    chrome.tabs.query({active:true,currentWindow:true},tabs=>{
      const tab=tabs[0];
      const url=tab.url||'';
      if(!url.includes('dfimoveis.com.br/imovel/')&&!url.includes('eemovel.com.br')){
        $('not-dfi').style.display='block';
        setStatus('Abra o DF Imóveis ou o Eemovel.','err');
        $('btn-extract').disabled=false;
        return;
      }
      chrome.scripting.executeScript({target:{tabId:tab.id},files:['content.js']},()=>{
        chrome.tabs.sendMessage(tab.id,{action:'extrair'},resp=>{
          if(chrome.runtime.lastError||!resp||!resp.ok){
            setStatus('Erro ao ler. Recarregue a página.','err');
            $('btn-extract').disabled=false;
            return;
          }
          dadosExtraidos=resp.dados;
          $('not-dfi').style.display='none';
          if(resp.dados.tipo_extracao==='proprietario'){
            $('mode-label').textContent='👤 Proprietário — Eemovel';
            $('form-imovel').style.display='none';
            $('form-prop').style.display='block';
            $('btn-save-prop').disabled=false;
            $('saved-msg-prop').style.display='none';
            preencherProprietario(resp.dados);
          } else {
            $('mode-label').textContent='🏠 Imóvel — DF Imóveis';
            $('form-prop').style.display='none';
            $('form-imovel').style.display='block';
            $('btn-save-im').disabled=false;
            $('saved-msg-im').style.display='none';
            preencherImovel(resp.dados);
          }
          setStatus('✓ Dados extraídos! Confira e salve.','ok');
          $('btn-extract').textContent='🔄 Extrair novamente';
          $('btn-extract').disabled=false;
        });
      });
    });
  });

  $('btn-save-im').addEventListener('click',salvarImovel);
  $('btn-save-prop').addEventListener('click',salvarProprietario);
  $('btn-open').addEventListener('click',e=>{e.preventDefault();chrome.tabs.create({url:SISTEMA_URL});});
});
