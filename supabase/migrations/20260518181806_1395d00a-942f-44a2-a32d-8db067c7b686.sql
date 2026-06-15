
CREATE TABLE public.legal_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view legal documents"
ON public.legal_documents FOR SELECT
USING (true);

CREATE POLICY "Admins manage legal documents"
ON public.legal_documents FOR ALL
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER legal_documents_set_updated_at
BEFORE UPDATE ON public.legal_documents
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.legal_documents (slug, title, content) VALUES
('termos', 'Termos de Serviço',
$html$<p>Bem-vindo à Pratô! Estes Termos de Serviço ("Termos") regem o seu acesso e uso da nossa plataforma online e dos serviços de fornecimento de refeições corporativas. Ao criar uma conta e utilizar nossos serviços, você, em nome da empresa que representa ("Cliente"), concorda em cumprir integralmente com as condições aqui estabelecidas.</p>

<h2>1. Definições</h2>
<p>Para os fins destes Termos, as seguintes palavras terão os significados abaixo:</p>
<ul>
<li><strong>Plataforma:</strong> Refere-se ao aplicativo web da Pratô, acessível através de nosso site oficial, onde os serviços são gerenciados.</li>
<li><strong>Serviços:</strong> Engloba o fornecimento das refeições (Marmitas Premium), o uso da Plataforma para gestão, compra de créditos, agendamentos e acompanhamento de consumo.</li>
<li><strong>Cliente:</strong> A pessoa jurídica (empresa) devidamente cadastrada que contrata os Serviços.</li>
<li><strong>Usuário:</strong> O representante legal ou colaborador autorizado pelo Cliente para operar a conta na Plataforma.</li>
<li><strong>Créditos:</strong> Unidades pré-pagas adquiridas pelo Cliente, onde cada crédito equivale a uma refeição.</li>
</ul>

<h2>2. Elegibilidade e Cadastro do Usuário</h2>
<p><strong>2.1. Elegibilidade:</strong> Os Serviços da Pratô destinam-se exclusivamente a pessoas jurídicas (empresas) legalmente constituídas e com sede no município de Pomerode, Santa Catarina. A Pratô se reserva o direito de verificar a localização e a regularidade da empresa e de recusar o cadastro caso não atenda a este critério.</p>
<p><strong>2.2. Veracidade das Informações:</strong> O Cliente é o único responsável pela veracidade, precisão e atualização de todas as informações fornecidas no momento do cadastro. A constatação de informações falsas ou imprecisas poderá levar à suspensão ou ao encerramento da conta, conforme a Cláusula 10 destes Termos.</p>
<p><strong>2.3. Responsabilidade pela Conta:</strong> A responsabilidade pela guarda e confidencialidade da senha de acesso é exclusiva do Cliente. Todas as atividades realizadas através da conta serão consideradas de responsabilidade do Cliente.</p>

<h2>3. Propriedade Intelectual</h2>
<p><strong>3.1. Titularidade:</strong> Todo o conteúdo, software, tecnologia, design, layout, textos, imagens e marcas (incluindo o nome e o logotipo "Pratô") disponibilizados na Plataforma são de propriedade exclusiva da Pratô, protegidos pelas leis de propriedade intelectual.</p>
<p><strong>3.2. Licença de Uso:</strong> Ao contratar os Serviços, o Cliente recebe uma licença de uso pessoal, limitada, não exclusiva, intransferível e revogável para acessar e utilizar a Plataforma estritamente para os fins previstos nestes Termos. Esta licença não concede qualquer direito de propriedade sobre a Plataforma ou seu conteúdo.</p>

<h2>4. Conduta do Usuário e Proibições</h2>
<p>Ao acessar e utilizar a plataforma Pratô, o usuário concorda em não realizar, nem auxiliar ou permitir que terceiros realizem, qualquer uma das seguintes ações:</p>
<p><strong>4.1. Atividades Ilegais e Fraudulentas</strong></p>
<ul>
<li>Utilizar a plataforma para qualquer finalidade que viole as leis vigentes no Brasil.</li>
<li>Fornecer informações cadastrais falsas, imprecisas ou incompletas.</li>
<li>Efetuar pagamentos através de meios fraudulentos.</li>
<li>Tentar manipular, duplicar ou gerar créditos de refeição de forma indevida.</li>
</ul>
<p><strong>4.2. Atos Contra a Segurança da Plataforma</strong></p>
<ul>
<li>Tentar decodificar, descompilar ou realizar engenharia reversa de qualquer software da plataforma.</li>
<li>Utilizar robôs, spiders ou outros meios automatizados para acessar o sistema sem autorização.</li>
<li>Realizar qualquer ato que vise sobrecarregar, danificar ou prejudicar a infraestrutura da Pratô.</li>
<li>Tentar obter acesso não autorizado a contas de outros usuários ou áreas administrativas.</li>
<li>Introduzir ou disseminar vírus ou qualquer outro tipo de código malicioso.</li>
</ul>
<p><strong>4.3. Violação de Propriedade Intelectual</strong></p>
<ul>
<li>Copiar, modificar, distribuir ou criar obras derivadas de qualquer conteúdo da plataforma sem autorização.</li>
<li>Utilizar a marca "Pratô" ou nosso logotipo de forma que possa causar confusão ou denegrir nossa imagem.</li>
</ul>
<p><strong>4.4. Mau Uso dos Serviços</strong></p>
<ul>
<li>Utilizar os canais de suporte para enviar mensagens de assédio, ameaças, spam ou conteúdo ofensivo.</li>
<li>Criar múltiplas contas para a mesma empresa com o objetivo de abusar de promoções ou contornar restrições.</li>
<li>Compartilhar as credenciais de acesso com terceiros não autorizados.</li>
</ul>

<h2>5. Aquisição, Validade e Utilização dos Créditos</h2>
<p><strong>5.1. Sistema de Créditos:</strong> Os serviços são disponibilizados através de um sistema de créditos pré-pagos. O Cliente escolhe um plano, realiza o pagamento e, após a confirmação, a conta é carregada com os créditos correspondentes.</p>
<p><strong>5.2. Paridade do Crédito:</strong> Cada um (1) crédito adquirido é estritamente equivalente a uma (1) refeição (Marmita Premium).</p>
<p><strong>5.3. Validade dos Créditos:</strong> Os créditos adquiridos em cada transação são válidos para uso por um período de 6 (seis) meses, a contar da data da confirmação do pagamento. Após este prazo, créditos não utilizados expirarão automaticamente, não sendo passíveis de reembolso ou reativação.</p>

<h2>6. Política de Reembolso e Cancelamento</h2>
<p><strong>6.1. Direito de Arrependimento:</strong> Para a primeira compra de um plano, o Cliente poderá solicitar o cancelamento e o reembolso integral no prazo de 7 (sete) dias corridos a contar da data da compra, desde que nenhum crédito tenha sido utilizado.</p>
<p><strong>6.2. Política de Não Reembolso:</strong> Decorrido o prazo de 7 dias, ou caso qualquer crédito do plano já tenha sido utilizado, o valor pago torna-se não reembolsável. O Cliente poderá utilizar seu saldo até o final da validade, não cabendo devolução de valores por créditos remanescentes.</p>
<p><strong>6.3. Estorno por Falha no Serviço:</strong> O estorno de créditos ocorrerá exclusivamente em caso de falha comprovada na prestação do serviço por parte da Pratô, como a não entrega de uma refeição confirmada.</p>

<h2>7. Política de Preços e Reajustes</h2>
<p><strong>7.1. Reajuste de Preços:</strong> A Pratô se reserva o direito de reajustar o preço de seus planos.</p>
<p><strong>7.2. Aplicação de Novos Preços:</strong> Qualquer alteração de preço será informada na plataforma e vigorará apenas para futuras compras. Créditos já adquiridos não serão afetados por novos reajustes.</p>

<h2>8. Agendamento, Entregas e Cancelamentos</h2>
<p><strong>8.1. Agendamento:</strong> Os agendamentos de refeições devem ser realizados através da Plataforma até as 8h00 do dia da entrega.</p>
<p><strong>8.2. Pedidos de Emergência:</strong> Pedidos realizados entre 8h01 e 9h45 estarão sujeitos à consulta de disponibilidade e poderão ser confirmados ou recusados pela Pratô.</p>
<p><strong>8.3. Cancelamento:</strong> O Cliente poderá cancelar um agendamento e obter o estorno integral do crédito se o cancelamento for realizado na Plataforma até as 8h00 do dia da entrega. Após este horário, o cancelamento não dará direito ao estorno do crédito.</p>

<h2>9. Limitação de Responsabilidade</h2>
<p>A Pratô se compromete a oferecer seus serviços com diligência. No entanto, nossa responsabilidade é limitada às seguintes condições:</p>
<p><strong>9.1. Conectividade e Acesso:</strong> Não nos responsabilizamos por falhas de acesso à Plataforma decorrentes de problemas na internet ou nos equipamentos do Cliente, nem por manutenções programadas ou casos de força maior.</p>
<p><strong>9.2. Segurança da Conta:</strong> A responsabilidade pela guarda da senha é exclusiva do Cliente.</p>
<p><strong>9.3. Informações Fornecidas:</strong> Não nos responsabilizamos por prejuízos decorrentes de informações incorretas (ex: endereço de entrega) fornecidas pelo Cliente.</p>
<p><strong>9.4. Alergias e Restrições:</strong> É de inteira responsabilidade do Cliente verificar os ingredientes e nos informar sobre quaisquer alergias ou restrições alimentares severas antes da contratação. Não nos responsabilizaremos por reações alérgicas caso não tenhamos sido previamente notificados por escrito.</p>
<p><strong>9.5. Danos Indiretos:</strong> Nossa responsabilidade total, em qualquer circunstância, estará limitada ao valor do serviço diretamente afetado pela falha (ex: o estorno do crédito da refeição não entregue).</p>

<h2>10. Privacidade e Proteção de Dados Pessoais</h2>
<p><strong>10.1. Compromisso:</strong> A Pratô compromete-se a tratar os dados pessoais em total conformidade com a Lei Geral de Proteção de Dados (LGPD).</p>
<p><strong>10.2. Política de Privacidade:</strong> Todos os detalhes sobre o tratamento de dados estão descritos em nossa Política de Privacidade, que é parte integrante e inseparável destes Termos.</p>
<p><strong>10.3. Consentimento:</strong> Ao aceitar estes Termos, o Cliente declara que leu, compreendeu e concordou integralmente com as disposições contidas em nossa Política de Privacidade.</p>

<h2>11. Modificações nos Termos de Serviço</h2>
<p>A Pratô se reserva o direito de modificar estes Termos a qualquer momento. As alterações serão comunicadas através de aviso na Plataforma ou por e-mail. A continuidade do uso dos Serviços após a notificação constituirá o aceite das novas condições. Caso o Cliente não concorde com as alterações, deverá solicitar o encerramento de sua conta, aplicando-se as regras da Cláusula 12.</p>

<h2>12. Vigência e Rescisão</h2>
<p><strong>12.1. Vigência:</strong> Estes Termos permanecem válidos por tempo indeterminado, enquanto o Cliente possuir uma conta ativa.</p>
<p><strong>12.2. Rescisão pelo Cliente:</strong> O Cliente poderá solicitar o encerramento de sua conta a qualquer momento através dos canais de suporte. O encerramento não dá direito ao reembolso de créditos remanescentes.</p>
<p><strong>12.3. Suspensão ou Rescisão pela Pratô:</strong> A Pratô poderá suspender ou encerrar a conta de um Cliente, sem aviso prévio, em caso de violação destes Termos, atividade fraudulenta, inadimplência ou risco à segurança da plataforma.</p>
<p><strong>12.4. Efeitos da Rescisão pela Pratô:</strong> Em caso de rescisão por culpa do Cliente, o acesso será bloqueado e eventuais créditos em saldo serão cancelados sem direito a reembolso, a título de multa contratual.</p>

<h2>13. Foro de Eleição</h2>
<p>Para a solução de quaisquer controvérsias decorrentes destes Termos, as partes elegem o Foro da Comarca de Pomerode, Estado de Santa Catarina, renunciando expressamente a qualquer outro.</p>$html$),

('privacidade', 'Política de Privacidade',
$html$<h2>1. Introdução e Compromisso</h2>
<p>A Pratô Serviços de Alimentação Ltda. ("Pratô", "nós") leva a sua privacidade a sério. Esta Política de Privacidade descreve como coletamos, utilizamos, armazenamos, compartilhamos e protegemos os dados pessoais dos representantes e colaboradores de nossos Clientes ("Você") ao utilizarem nossa plataforma e nossos serviços, em total conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).</p>

<h2>2. Quais Dados Coletamos e Por Quê?</h2>
<p>Coletamos apenas os dados estritamente necessários para a prestação de nossos serviços. Estes dados são divididos em duas categorias:</p>
<p><strong>2.1. Dados da Empresa Cliente (Pessoa Jurídica):</strong></p>
<ul>
<li><strong>Dados:</strong> Razão Social, CNPJ, Inscrição Estadual/Municipal, Endereço completo para entrega e faturamento.</li>
<li><strong>Finalidade:</strong> Cumprir obrigações contratuais, logísticas (entrega das refeições) e fiscais (emissão de notas).</li>
</ul>
<p><strong>2.2. Dados Pessoais do(s) Usuário(s) Representante(s) (Pessoa Física):</strong></p>
<ul>
<li><strong>Dados:</strong> Nome completo, e-mail corporativo, número de telefone.</li>
<li><strong>Finalidade:</strong>
<ul>
<li><strong>Criação e Gestão da Conta:</strong> Para criar o login de acesso à plataforma e garantir a segurança da conta.</li>
<li><strong>Comunicações Operacionais:</strong> Para enviar confirmações de agendamento, avisos sobre a conta, notificações de saldo baixo e atualizações sobre o serviço.</li>
<li><strong>Suporte ao Cliente:</strong> Para identificar o usuário e prestar o devido suporte quando solicitado.</li>
<li><strong>Processamento de Pagamentos:</strong> Embora não armazenemos dados de cartão de crédito, compartilhamos as informações necessárias com nosso gateway de pagamento (ex: nome, e-mail) para processar a transação de forma segura.</li>
</ul>
</li>
</ul>

<h2>3. Com Quem Compartilhamos Seus Dados?</h2>
<p>A sua privacidade é nossa prioridade. Não vendemos, alugamos ou trocamos seus dados pessoais com terceiros para fins de marketing. O compartilhamento ocorre apenas quando necessário para a operação do nosso serviço:</p>
<ul>
<li><strong>Gateways de Pagamento:</strong> Para processar as transações de compra dos pacotes de créditos.</li>
<li><strong>Ferramentas de Automação (ex: n8n) e CRM (ex: DataCrazy):</strong> Para gerenciar o funil de atendimento, enviar comunicações operacionais e prestar suporte, sempre sob estritas obrigações de confidencialidade.</li>
<li><strong>Autoridades Legais:</strong> Em caso de obrigação legal ou ordem judicial, poderemos ser obrigados a compartilhar informações com autoridades competentes.</li>
</ul>

<h2>4. Por Quanto Tempo Armazenamos Seus Dados?</h2>
<p>Manteremos seus dados pessoais armazenados apenas pelo tempo necessário para cumprir as finalidades para as quais foram coletados, incluindo o cumprimento de obrigações legais, contratuais, fiscais ou para a prestação de contas. Após o encerramento da conta e decorridos os prazos legais de guarda, os dados serão excluídos de forma segura ou anonimizados.</p>

<h2>5. Segurança dos Seus Dados</h2>
<p>Adotamos medidas técnicas e administrativas robustas para proteger seus dados contra acesso não autorizado, perda, alteração ou destruição. Nossas medidas incluem, mas não se limitam a:</p>
<ul>
<li>Criptografia de dados em trânsito (SSL/TLS).</li>
<li>Controle de acesso restrito aos nossos sistemas.</li>
<li>Monitoramento contínuo de nossa infraestrutura para identificar e mitigar vulnerabilidades.</li>
</ul>

<h2>6. Seus Direitos como Titular dos Dados</h2>
<p>De acordo com a LGPD, você tem o direito de, a qualquer momento, solicitar:</p>
<ul>
<li>Confirmação da existência de tratamento de seus dados.</li>
<li>Acesso aos seus dados.</li>
<li>Correção de dados incompletos, inexatos ou desatualizados.</li>
<li>Anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade com a lei.</li>
<li>Portabilidade dos seus dados a outro fornecedor de serviço.</li>
<li>Informação sobre as entidades com as quais compartilhamos seus dados.</li>
<li>Revogação do consentimento, quando aplicável.</li>
</ul>
<p>Para exercer seus direitos, entre em contato conosco através do canal informado na seção 8.</p>

<h2>7. Cookies</h2>
<p>Nossa plataforma utiliza cookies essenciais para o seu funcionamento (ex: manter o usuário logado) e cookies de análise (ex: Google Analytics) para entendermos como os usuários interagem com o site, o que nos ajuda a melhorar nossos serviços. Ao utilizar nosso site, você concorda com o uso de cookies.</p>

<h2>8. Encarregado pela Proteção de Dados (DPO)</h2>
<p>Para qualquer dúvida sobre esta Política de Privacidade ou para exercer seus direitos como titular dos dados, entre em contato com nosso Encarregado pela Proteção de Dados (DPO):</p>
<ul>
<li><strong>Nome do Encarregado:</strong> Em breve.</li>
<li><strong>E-mail de Contato:</strong> privacidade@pratoservicos.com</li>
</ul>

<h2>9. Alterações nesta Política</h2>
<p>Podemos atualizar esta Política de Privacidade periodicamente para refletir mudanças em nossas práticas ou na legislação. Quando o fizermos, a data da "Última atualização" no topo da página será alterada. Recomendamos que você revise esta página regularmente para se manter informado.</p>$html$);
