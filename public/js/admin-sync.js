// Os dois painéis editam o banco do endereço em que foram abertos.
document.addEventListener('DOMContentLoaded', async () => {
    for (const aviso of document.querySelectorAll('[data-admin-environment]')) {
        aviso.style.cssText = 'padding:16px;border:1px solid var(--border);border-radius:12px;margin:16px 0;background:var(--surface-2);font-size:14px';
        try {
            const resposta = await fetch('/api/site-info', { cache: 'no-store' });
            if (!resposta.ok) throw new Error('Não foi possível identificar o ambiente.');
            const info = await resposta.json();
            aviso.textContent = info.ambiente === 'production'
                ? 'Admin do site publicado: ao salvar, suas alterações ficam disponíveis para todos, sem republicar.'
                : 'Admin do preview: alterações feitas aqui ficam apenas no banco de testes. Republicar não transfere estes dados.';
            if (info.urlPublica && info.ambiente !== 'production') {
                const url = new URL(info.urlPublica);
                if (url.protocol === 'https:') {
                    const link = document.createElement('a');
                    link.href = new URL('/admin', url).href;
                    link.target = '_blank';
                    link.rel = 'noopener';
                    link.textContent = ' Editar o site publicado';
                    aviso.append(link);
                }
            }
        } catch (erro) {
            aviso.textContent = `${erro.message} Confira se está no endereço publicado antes de editar.`;
        }
    }

    for (const area of document.querySelectorAll('[data-admin-image-tools]')) {
        area.style.cssText = 'padding:16px;border:1px solid var(--border);border-radius:12px;margin:0 0 16px;font-size:14px';
        const texto = document.createElement('p');
        texto.textContent = 'Transferir fotos do preview: exporte aqui e importe no admin do site publicado. Só imagens ausentes serão preenchidas; preços, textos e fotos existentes serão preservados.';
        area.append(texto);
        const exportar = document.createElement('button');
        exportar.type = 'button';
        exportar.className = 'btn btn-secondary btn-sm';
        exportar.textContent = 'Exportar imagens';
        const importar = document.createElement('button');
        importar.type = 'button';
        importar.className = 'btn btn-secondary btn-sm';
        importar.textContent = 'Importar imagens ausentes';
        importar.style.margin = '8px';
        const arquivo = document.createElement('input');
        arquivo.type = 'file';
        arquivo.accept = '.json,application/json';
        arquivo.hidden = true;
        const mensagem = document.createElement('p');
        mensagem.setAttribute('role', 'status');
        area.append(exportar, importar, arquivo, mensagem);

        exportar.addEventListener('click', async () => {
            try {
                const resposta = await fetch('/api/vinhos', { cache: 'no-store' });
                if (!resposta.ok) throw new Error('Não foi possível exportar as imagens.');
                const vinhos = (await resposta.json()).filter(v => v.imagem)
                    .map(({ id, nome, imagem }) => ({ id, nome, imagem }));
                const url = URL.createObjectURL(new Blob([JSON.stringify({ formato: 'vinhos-imagens', vinhos })], { type: 'application/json' }));
                const link = document.createElement('a');
                link.href = url;
                link.download = 'imagens-vinhos.json';
                link.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                mensagem.textContent = `${vinhos.length} imagens exportadas. Importe o arquivo no admin do site publicado.`;
            } catch (erro) {
                mensagem.textContent = erro.message;
            }
        });
        importar.addEventListener('click', () => arquivo.click());
        arquivo.addEventListener('change', async () => {
            const selecionado = arquivo.files[0];
            if (!selecionado) return;
            try {
                if (selecionado.size > 4_900_000) throw new Error('O arquivo ultrapassa o limite de 4,9 MB.');
                const dados = JSON.parse(await selecionado.text());
                if (dados.formato !== 'vinhos-imagens' || !Array.isArray(dados.vinhos)) {
                    throw new Error('Escolha o arquivo gerado por Exportar imagens.');
                }
                if (!confirm(`Importar ${dados.vinhos.length} imagens neste catálogo? Apenas fotos ausentes serão preenchidas. Nenhuma outra informação será alterada.`)) return;
                importar.disabled = true;
                mensagem.textContent = 'Importando imagens...';
                const token = window.csrfAdmin || (typeof estadoAdmin !== 'undefined' ? estadoAdmin.csrfToken : '');
                const resposta = await fetch('/api/admin/importar-imagens', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
                    body: JSON.stringify(dados)
                });
                const resultado = await resposta.json();
                if (!resposta.ok) throw new Error(resultado.erro || 'Não foi possível importar.');
                mensagem.textContent = `${resultado.importadas} imagens importadas; ${resultado.preservadas} fotos existentes preservadas. Já estão disponíveis para os visitantes.`;
                document.dispatchEvent(new Event('catalogo-importado'));
            } catch (erro) {
                mensagem.textContent = erro.message;
            } finally {
                importar.disabled = false;
                arquivo.value = '';
            }
        });
    }
});
