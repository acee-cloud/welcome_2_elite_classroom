'use strict';

/**
 * KaTeX Rendering Utilities
 *
 * Browser – thêm vào <head> của HTML:
 *   <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
 *   <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"
 *           onload="window.__katexReady=true"></script>
 *
 * Node.js:
 *   npm install katex
 *   const { renderTeX, renderQuestion } = require('./questions');
 *   // truyền katex instance vào hàm nếu cần
 */

/**
 * Render các biểu thức LaTeX $...$ trong chuỗi văn bản thành HTML (KaTeX).
 * @param {string} text         - Văn bản chứa $...$ LaTeX
 * @param {object} [kt]         - KaTeX instance (mặc định: global `katex`)
 * @returns {string}            - HTML đã render, hoặc text gốc nếu KaTeX chưa load
 */
function renderTeX(text, kt) {
  const katexLib = kt || (typeof katex !== 'undefined' ? katex : null);
  if (!katexLib || typeof text !== 'string') return text;
  return text.replace(/\$((?:[^$\\]|\\.)+)\$/g, (match, math) => {
    try {
      return katexLib.renderToString(math, {
        throwOnError: false,
        displayMode: false,
        strict: false,
      });
    } catch (_) {
      return match; // fallback: giữ nguyên nếu lỗi parse
    }
  });
}

/**
 * Render tất cả LaTeX trong một đối tượng câu hỏi.
 * @param {object} q   - { question, options: {A,B,C,D}, answer }
 * @param {object} [kt] - KaTeX instance (tuỳ chọn)
 * @returns {object}   - Câu hỏi với HTML KaTeX thay thế LaTeX
 */
function renderQuestion(q, kt) {
  return {
    question: renderTeX(q.question, kt),
    options: {
      A: renderTeX(q.options.A, kt),
      B: renderTeX(q.options.B, kt),
      C: renderTeX(q.options.C, kt),
      D: renderTeX(q.options.D, kt),
    },
    answer: q.answer,
  };
}

// Helper: convert compact array format to question object
function q(arr) {
  return arr.map(([question, A, B, C, D, answer]) => ({
    question, options: { A, B, C, D }, answer
  }));
}

// ============================
// CHƯƠNG 1: DAO ĐỘNG (50 câu)
// ============================
const c1s1 = q([
  ["Dao động cơ học là:", "Chuyển động thẳng đều.", "Chuyển động có giới hạn trong không gian, lặp lại quanh vị trí cân bằng.", "Chuyển động tròn đều.", "Chuyển động biến đổi đều.", "B"],
  ["Trong dao động điều hòa $x = A\\cos(\\omega t + \\varphi)$, đại lượng $A$ gọi là:", "Tần số góc.", "Biên độ dao động.", "Pha ban đầu.", "Li độ.", "B"],
  ["Chu kì dao động $T$ là:", "Số dao động trong một giây.", "Khoảng thời gian vật đi từ biên âm đến biên dương.", "Khoảng thời gian để vật thực hiện một dao động toàn phần.", "Thời gian ngắn nhất vật đi qua vị trí cân bằng.", "C"],
  ["Mối liên hệ giữa chu kì $T$ và tần số góc $\\omega$ là:", "$\\omega = 2\\pi T$", "$\\omega = T/2\\pi$", "$T = 2\\pi/\\omega$", "$T = 2\\pi\\omega$", "C"],
  ["Pha của dao động $(\\omega t + \\varphi)$ cho biết:", "Trạng thái dao động của vật ở thời điểm t.", "Vị trí của vật ở thời điểm ban đầu.", "Năng lượng của vật.", "Chu kì dao động của vật.", "A"],
]);
const c1s2 = q([
  ["Vận tốc trong dao động điều hòa biến thiên điều hòa:", "Cùng pha với li độ.", "Ngược pha với li độ.", "Sớm pha $\\pi/2$ so với li độ.", "Trễ pha $\\pi/2$ so với li độ.", "C"],
  ["Gia tốc của vật dao động điều hòa luôn:", "Hướng cùng chiều chuyển động.", "Hướng về vị trí biên.", "Hướng về vị trí cân bằng.", "Có độ lớn không đổi.", "C"],
  ["Công thức tính gia tốc trong dao động điều hòa là:", "$a = \\omega x$", "$a = -\\omega^2 x$", "$a = -\\omega x^2$", "$a = \\omega^2 x$", "B"],
  ["Vận tốc của vật dao động điều hòa đạt độ lớn cực đại khi:", "Vật ở vị trí biên.", "Vật đi qua vị trí cân bằng.", "Gia tốc đạt cực đại.", "Li độ có độ lớn cực đại.", "B"],
  ["Tại vị trí biên, gia tốc của vật có độ lớn:", "Bằng 0.", "Bằng $\\omega A$.", "Bằng $\\omega^2 A$.", "Bằng $\\omega/A$.", "C"],
]);
const c1s3 = q([
  ["Hệ thức liên hệ giữa $x$, $v$, $\\omega$ và $A$ là:", "$A^2 = x^2 + v^2/\\omega^2$", "$A^2 = v^2 + x^2/\\omega^2$", "$A^2 = x^2 + \\omega^2 v^2$", "$A^2 = x^2 - v^2/\\omega^2$", "A"],
  ["Vật dao động điều hòa biên độ 5 cm, tần số góc 10 rad/s. Tốc độ cực đại là:", "50 cm/s", "0,5 cm/s", "50 m/s", "2 cm/s", "A"],
  ["Khi vật qua vị trí có li độ $x = 0$ thì:", "Động năng bằng 0.", "Vận tốc bằng 0.", "Lực kéo về có độ lớn cực đại.", "Gia tốc bằng 0.", "D"],
  ["Lực kéo về tác dụng lên vật dao động điều hòa có biểu thức:", "$F = -kx$", "$F = kx$", "$F = -kx^2$", "$F = kx^2/2$", "A"],
  ["Lực kéo về luôn:", "Cùng pha với vận tốc.", "Ngược pha với li độ.", "Cùng pha với li độ.", "Sớm pha $\\pi/2$ so với li độ.", "B"],
]);
const c1s4 = q([
  ["Tần số góc của con lắc lò xo được tính bằng công thức:", "$\\omega = \\sqrt{m/k}$", "$\\omega = \\sqrt{k/m}$", "$\\omega = 2\\pi\\sqrt{k/m}$", "$\\omega = \\sqrt{k/m}/2\\pi$", "B"],
  ["Tăng khối lượng con lắc lò xo lên 4 lần, chu kì dao động sẽ:", "Tăng 2 lần.", "Giảm 2 lần.", "Tăng 4 lần.", "Không đổi.", "A"],
  ["Độ cứng lò xo $k$ phụ thuộc vào:", "Khối lượng vật nặng.", "Cấu tạo và bản chất của lò xo.", "Biên độ dao động.", "Vị trí đặt con lắc.", "B"],
  ["Chiều dài quỹ đạo của vật dao động điều hòa bằng:", "A", "2A", "4A", "A/2", "B"],
  ["Tại vị trí cân bằng, lò xo của con lắc lò xo nằm ngang:", "Bị nén cực đại.", "Bị dãn cực đại.", "Không biến dạng.", "Tác dụng lực đàn hồi lớn nhất.", "C"],
]);
const c1s5 = q([
  ["Động năng của vật dao động điều hòa có công thức:", "$W_d = mv^2/2$", "$W_d = kx^2/2$", "$W_d = m\\omega^2 x^2/2$", "$W_d = kA^2/2$", "A"],
  ["Thế năng con lắc lò xo đạt giá trị cực tiểu khi:", "Vật ở vị trí biên dương.", "Vật ở vị trí biên âm.", "Vật qua vị trí cân bằng.", "Li độ $x = A/2$.", "C"],
  ["Cơ năng con lắc lò xo được bảo toàn khi:", "Bỏ qua mọi ma sát.", "Chu kì rất nhỏ.", "Khối lượng rất lớn.", "Lò xo rất cứng.", "A"],
  ["Công thức tính cơ năng dao động điều hòa:", "$W = kx^2/2$", "$W = mv^2/2$", "$W = kA^2/2$", "$W = kA^2$", "C"],
  ["Nếu biên độ dao động tăng gấp đôi thì cơ năng sẽ:", "Tăng gấp đôi.", "Tăng gấp bốn.", "Không đổi.", "Giảm một nửa.", "B"],
]);
const c1s6 = q([
  ["Chu kì dao động điều hòa con lắc đơn phụ thuộc vào:", "Khối lượng vật nặng.", "Biên độ dao động.", "Chiều dài dây treo và gia tốc trọng trường.", "Cách kích thích dao động.", "C"],
  ["Công thức tính tần số con lắc đơn là:", "$f = 2\\pi\\sqrt{l/g}$", "$f = \\sqrt{g/l}/2\\pi$", "$f = 2\\pi\\sqrt{g/l}$", "$f = \\sqrt{l/g}/2\\pi$", "B"],
  ["Điều kiện để con lắc đơn dao động điều hòa là:", "Bỏ qua ma sát và góc lệch $\\alpha_0 \\le 10°$.", "Dây treo phải rất ngắn.", "Khối lượng vật nặng rất nhỏ.", "Gia tốc trọng trường phải lớn.", "A"],
  ["Lực kéo về của con lắc đơn dao động điều hòa là:", "Trọng lực.", "Lực căng dây.", "Thành phần tiếp tuyến của trọng lực.", "Thành phần hướng tâm của trọng lực.", "C"],
  ["Chiều dài con lắc đơn giảm 4 lần, chu kì dao động sẽ:", "Tăng 2 lần.", "Giảm 2 lần.", "Giảm 4 lần.", "Không đổi.", "B"],
]);
const c1s7 = q([
  ["Ứng dụng quan trọng nhất của con lắc đơn trong thực tế là:", "Làm đồng hồ quả lắc.", "Xác định gia tốc rơi tự do tại một nơi.", "Chế tạo thiết bị đo chiều dài.", "Đo khối lượng của vật.", "B"],
  ["Con lắc đơn dao động chu kì 2s. Thời gian vật đi từ biên đến vị trí cân bằng là:", "1s", "0,5s", "2s", "0,25s", "B"],
  ["Hai con lắc đơn $T_1 = 3s$, $T_2 = 4s$. Con lắc có chiều dài $l = l_1 + l_2$ có chu kì:", "1s", "5s", "7s", "2,6s", "B"],
  ["Năng lượng dao động của con lắc đơn (bỏ qua ma sát) sẽ:", "Giảm dần theo thời gian.", "Chuyển hóa hoàn toàn thành nhiệt năng.", "Là một hằng số.", "Tăng dần theo thời gian.", "C"],
  ["Đưa con lắc đơn từ Trái Đất lên Mặt Trăng, chu kì sẽ:", "Không đổi.", "Giảm đi.", "Tăng lên.", "Bằng 0.", "C"],
]);
const c1s8 = q([
  ["Dao động tắt dần là dao động có:", "Biên độ giảm dần theo thời gian.", "Chu kì giảm dần theo thời gian.", "Tần số giảm dần theo thời gian.", "Vận tốc luôn giảm dần.", "A"],
  ["Nguyên nhân gây ra dao động tắt dần là do:", "Trọng lực.", "Lực ma sát và lực cản của môi trường.", "Lực căng dây.", "Kích thích dao động ban đầu nhỏ.", "B"],
  ["Dao động tắt dần nhanh hơn khi:", "Lực cản môi trường càng lớn.", "Khối lượng vật càng lớn.", "Biên độ ban đầu càng lớn.", "Độ cứng lò xo càng nhỏ.", "A"],
  ["Đặc điểm nào sau đây KHÔNG phải của dao động tắt dần:", "Cơ năng giảm dần.", "Động năng cực đại giảm dần.", "Lực cản luôn sinh công âm.", "Chu kì dao động tăng liên tục.", "D"],
  ["Ứng dụng có ích của dao động tắt dần là:", "Quả lắc đồng hồ.", "Bộ giảm xóc ô tô, xe máy.", "Con lắc lò xo trong phòng thí nghiệm.", "Con lắc Foucault.", "B"],
]);
const c1s9 = q([
  ["Dao động cưỡng bức là dao động:", "Chịu tác dụng của lực cản môi trường.", "Có biên độ giảm dần.", "Chịu tác dụng của một ngoại lực tuần hoàn.", "Tự phát sau khi được kích thích.", "C"],
  ["Tần số dao động cưỡng bức khi ổn định luôn:", "Bằng tần số riêng của hệ.", "Bằng tần số của ngoại lực tuần hoàn.", "Bằng tổng tần số riêng và tần số ngoại lực.", "Không xác định được.", "B"],
  ["Hiện tượng cộng hưởng xảy ra khi:", "Tần số ngoại lực lớn hơn tần số riêng.", "Lực cản môi trường bằng 0.", "Tần số ngoại lực bằng tần số riêng của hệ.", "Biên độ ngoại lực đạt cực đại.", "C"],
  ["Khi xảy ra cộng hưởng cơ, đại lượng nào đạt giá trị cực đại?", "Tần số dao động.", "Pha ban đầu.", "Biên độ dao động.", "Lực ma sát.", "C"],
  ["Cộng hưởng cơ học có thể gây tác hại trong trường hợp:", "Đánh đàn guitar.", "Bắn súng.", "Đoàn quân bước đều qua cầu yếu.", "Lò vi sóng hoạt động.", "C"],
]);
const c1s10 = q([
  ["Trong phương trình $v = -\\omega A\\sin(\\omega t + \\varphi)$, đại lượng $\\omega A$ gọi là:", "Vận tốc tức thời.", "Gia tốc cực đại.", "Tốc độ cực đại.", "Vận tốc trung bình.", "C"],
  ["Khoảng thời gian giữa hai lần liên tiếp động năng bằng thế năng là:", "T/2", "T/4", "T", "T/8", "B"],
  ["Quãng đường vật đi trong 1 chu kì là 20 cm. Biên độ dao động là:", "10 cm.", "5 cm.", "20 cm.", "40 cm.", "B"],
  ["Chọn phát biểu đúng về năng lượng trong dao động điều hòa:", "Động năng và thế năng biến thiên tuần hoàn với chu kì T.", "Động năng và thế năng biến thiên tuần hoàn với chu kì T/2.", "Cơ năng biến thiên tuần hoàn với chu kì T.", "Tổng động năng và gia tốc luôn bảo toàn.", "B"],
  ["Đồ thị vận tốc theo li độ có dạng là đường:", "Thẳng.", "Parabol.", "Hình sin.", "Elip.", "D"],
]);

// ============================
// CHƯƠNG 2: SÓNG (50 câu)
// ============================
const c2s1 = q([
  ["Sóng cơ là:", "Sự truyền chuyển động của các phần tử trong môi trường.", "Những dao động cơ lan truyền trong môi trường vật chất.", "Sự lan truyền vật chất trong không gian theo thời gian.", "Chuyển động của các hạt vi mô trong không gian.", "B"],
  ["Sóng ngang là sóng có phương dao động:", "Nằm ngang.", "Vuông góc với phương truyền sóng.", "Trùng với phương truyền sóng.", "Thẳng đứng.", "B"],
  ["Sóng dọc truyền được trong các môi trường nào?", "Chỉ trong chất khí.", "Trong chất rắn và bề mặt chất lỏng.", "Chỉ trong chất rắn.", "Cả chất rắn, chất lỏng và chất khí.", "D"],
  ["Sóng cơ học KHÔNG thể lan truyền trong môi trường nào?", "Nước biển.", "Không khí.", "Chân không.", "Tường gạch.", "C"],
  ["Sóng cơ truyền từ không khí vào nước, đại lượng nào không đổi?", "Vận tốc truyền sóng.", "Bước sóng.", "Tần số sóng.", "Năng lượng sóng.", "C"],
]);
const c2s2 = q([
  ["Bước sóng $\\lambda$ là:", "Khoảng cách giữa hai điểm dao động cùng pha gần nhau nhất trên phương truyền sóng.", "Quãng đường sóng truyền được trong 1 chu kì dao động.", "Khoảng cách giữa hai đỉnh sóng liên tiếp.", "Quãng đường sóng truyền trong 1 giây.", "B"],
  ["Công thức liên hệ bước sóng $\\lambda$, vận tốc $v$, chu kì $T$ và tần số $f$ là:", "$\\lambda = vT = v/f$", "$\\lambda = v/T = vf$", "$v = \\lambda T = \\lambda/f$", "$\\lambda = vT = vf$", "A"],
  ["Khoảng cách giữa hai điểm gần nhau nhất dao động ngược pha là:", "$\\lambda$", "$\\lambda/2$", "$\\lambda/4$", "$2\\lambda$", "B"],
  ["Tốc độ truyền sóng cơ học phụ thuộc chủ yếu vào:", "Tần số dao động của nguồn.", "Bước sóng.", "Bản chất của môi trường truyền sóng.", "Biên độ dao động.", "C"],
  ["Phao trên biển nhô lên 5 lần trong 8 giây. Chu kì sóng biển là:", "8s.", "2s.", "1,6s.", "4s.", "B"],
]);
const c2s3 = q([
  ["Sóng $u = A\\cos(\\omega t - 2\\pi x/\\lambda)$, đại lượng $x$ biểu thị:", "Li độ dao động tại một thời điểm.", "Vận tốc truyền sóng.", "Tọa độ của điểm đang xét so với nguồn.", "Khoảng cách giữa hai phần tử vật chất.", "C"],
  ["Độ lệch pha giữa hai điểm cách nhau $d$ trên cùng phương truyền sóng là:", "$\\Delta\\varphi = \\pi d/\\lambda$", "$\\Delta\\varphi = 2\\pi\\lambda/d$", "$\\Delta\\varphi = 2\\pi d/\\lambda$", "$\\Delta\\varphi = 2\\pi d/v$", "C"],
  ["Hai điểm dao động cùng pha khi khoảng cách thỏa mãn:", "$d = k\\lambda$", "$d = (k+0{,}5)\\lambda$", "$d = (2k+1)\\lambda$", "$d = k\\lambda/2$", "A"],
  ["Sóng truyền tốc độ 5 m/s, tần số 10 Hz. Bước sóng là:", "0,5 m.", "2 m.", "50 m.", "5 m.", "A"],
  ["Phương trình $u = 4\\cos(20\\pi t - \\pi x)$ (m, s). Tốc độ truyền sóng là:", "10 m/s.", "20 m/s.", "40 m/s.", "20 cm/s.", "B"],
]);
const c2s4 = q([
  ["Giao thoa sóng xảy ra khi có hai sóng:", "Xuất phát từ hai nguồn bất kì.", "Có cùng tần số.", "Từ hai nguồn cùng phương, cùng tần số và độ lệch pha không đổi.", "Có cùng biên độ.", "C"],
  ["Trong giao thoa sóng mặt nước, đường cong cực đại có hình dạng là:", "Các đường tròn đồng tâm.", "Các đường elip.", "Các đường parabol.", "Các đường hypebol.", "D"],
  ["Hai nguồn cùng pha, điểm dao động biên độ cực đại khi hiệu đường đi $d_2 - d_1$ bằng:", "Số nguyên lần bước sóng ($k\\lambda$).", "Số lẻ lần nửa bước sóng ($(2k+1)\\lambda/2$).", "Số nguyên lần nửa bước sóng ($k\\lambda/2$).", "Một phần tư bước sóng.", "A"],
  ["Hai nguồn cùng pha, điểm biên độ cực tiểu thỏa mãn:", "$d_2 - d_1 = k\\lambda$", "$d_2 - d_1 = (k+0{,}5)\\lambda$", "$d_2 - d_1 = 2k\\lambda$", "$d_2 - d_1 = \\lambda/4$", "B"],
  ["Hiện tượng giao thoa chứng tỏ điều gì?", "Sự tồn tại của các hạt vi mô.", "Năng lượng được bảo toàn.", "Tính chất sóng của ánh sáng và âm.", "Ánh sáng là sóng điện từ.", "C"],
]);
const c2s5 = q([
  ["Giao thoa hai nguồn cùng pha, khoảng cách giữa hai cực đại liên tiếp trên đường nối hai nguồn bằng:", "$\\lambda$", "$\\lambda/2$", "$\\lambda/4$", "$2\\lambda$", "B"],
  ["Khoảng cách giữa một cực đại và một cực tiểu liên tiếp trên đường nối hai nguồn là:", "$\\lambda$", "$\\lambda/2$", "$\\lambda/4$", "$\\lambda/8$", "C"],
  ["Hai nguồn đồng pha. Đường trung trực đoạn nối hai nguồn là:", "Đường hypebol cực đại.", "Đường thẳng cực đại.", "Đường thẳng cực tiểu.", "Đường tròn.", "B"],
  ["Bước sóng 2 cm. Khoảng cách giữa 3 cực đại liên tiếp trên đường nối hai nguồn là:", "2 cm.", "4 cm.", "6 cm.", "3 cm.", "B"],
  ["Hai nguồn dao động ngược pha, đường trung trực là:", "Điểm đứng yên (cực tiểu).", "Điểm dao động mạnh nhất (cực đại).", "Có thể cực đại hoặc cực tiểu.", "Không dao động.", "A"],
]);
const c2s6 = q([
  ["Sóng phản xạ tại vật cản cố định sẽ:", "Cùng pha với sóng tới.", "Ngược pha với sóng tới tại điểm phản xạ.", "Vuông pha với sóng tới.", "Bị suy giảm hoàn toàn năng lượng.", "B"],
  ["Sóng dừng là hiện tượng:", "Sóng không truyền đi được.", "Giao thoa giữa sóng tới và sóng phản xạ trên cùng phương truyền.", "Các phần tử môi trường đứng yên không dao động.", "Sóng bị dập tắt bởi ma sát.", "B"],
  ["Khoảng cách giữa hai nút sóng liên tiếp trong sóng dừng bằng:", "Một bước sóng.", "Nửa bước sóng.", "Một phần tư bước sóng.", "Hai bước sóng.", "B"],
  ["Khoảng cách từ một nút sóng đến một bụng sóng liền kề là:", "$\\lambda/2$", "$\\lambda$", "$\\lambda/4$", "$\\lambda/8$", "C"],
  ["Đặc điểm của nút sóng trong sóng dừng là:", "Dao động với biên độ lớn nhất.", "Dao động với biên độ bằng nửa biên độ cực đại.", "Luôn luôn đứng yên.", "Chuyển động cùng chiều với sóng tới.", "C"],
]);
const c2s7 = q([
  ["Điều kiện sóng dừng trên sợi dây chiều dài $l$ với 2 đầu cố định là:", "$l = k\\lambda/2$ (với $k = 1, 2, 3...$)", "$l = (2k+1)\\lambda/4$", "$l = k\\lambda$", "$l = (k+0{,}5)\\lambda$", "A"],
  ["Điều kiện sóng dừng với một đầu cố định, một đầu tự do là:", "$l = k\\lambda$", "$l = k\\lambda/2$", "$l = (2k+1)\\lambda/4$", "$l = (2k+1)\\lambda/2$", "C"],
  ["Sóng dừng 2 đầu cố định có 4 bó sóng. Số nút sóng (tính cả 2 đầu) là:", "3", "4", "5", "6", "C"],
  ["Dây dài 1 m, 2 đầu cố định, vận tốc 10 m/s. Tần số cơ bản là:", "5 Hz.", "10 Hz.", "20 Hz.", "2,5 Hz.", "A"],
  ["Ứng dụng thực tế phổ biến nhất của sóng dừng là:", "Chế tạo hộp đàn, ống sáo (nhạc cụ).", "Truyền tín hiệu viễn thông.", "Chế tạo lò vi sóng.", "Giảm xóc cho ô tô.", "A"],
]);
const c2s8 = q([
  ["Sóng âm bản chất là:", "Sóng điện từ.", "Sóng cơ học.", "Ánh sáng nhìn thấy.", "Dòng các hạt electron.", "B"],
  ["Tai người bình thường nghe được âm tần số:", "Dưới 16 Hz.", "Từ 16 Hz đến 20000 Hz.", "Trên 20000 Hz.", "Từ 0 Hz đến 16 Hz.", "B"],
  ["Sóng siêu âm có tần số:", "Nhỏ hơn 16 Hz.", "Trong vùng nghe được nhưng cường độ rất lớn.", "Lớn hơn 20000 Hz.", "Bằng tần số sóng vô tuyến.", "C"],
  ["Đặc trưng nào sau đây KHÔNG phải là đặc trưng vật lí của âm?", "Tần số âm.", "Cường độ âm.", "Âm sắc.", "Đồ thị dao động âm.", "C"],
  ["Cường độ âm $I$ được đo bằng đơn vị:", "W/m² (Oát trên mét vuông).", "J/s (Jun trên giây).", "B (Ben).", "dB (Đềxiben).", "A"],
]);
const c2s9 = q([
  ["Ba đặc trưng sinh lí của âm bao gồm:", "Tần số, cường độ và mức cường độ.", "Độ cao, độ to và âm sắc.", "Chu kì, bước sóng và năng lượng.", "Biên độ, vận tốc và gia tốc.", "B"],
  ["Độ cao của âm gắn liền với đặc trưng vật lí nào?", "Cường độ âm.", "Tần số âm.", "Biên độ dao động.", "Mức cường độ âm.", "B"],
  ["Độ to của âm gắn liền với:", "Tần số âm.", "Mức cường độ âm.", "Đồ thị dao động.", "Vận tốc truyền âm.", "B"],
  ["Tiếng đàn nhị và sáo trúc cùng nốt nhạc, độ to giống nhau, người nghe vẫn phân biệt được nhờ:", "Độ to.", "Độ cao.", "Âm sắc.", "Mức cường độ âm.", "C"],
  ["Âm sắc phụ thuộc chặt chẽ vào:", "Cường độ âm.", "Năng lượng âm.", "Tần số cơ bản của âm.", "Đồ thị dao động của âm (chứa các họa âm).", "D"],
]);
const c2s10 = q([
  ["Công thức tính mức cường độ âm $L$ (đơn vị Ben) là:", "$L = 10\\log(I/I_0)$", "$L = \\log(I/I_0)$", "$L = \\ln(I/I_0)$", "$L = 10\\ln(I/I_0)$", "B"],
  ["Vận tốc truyền sóng âm trong các môi trường xếp theo thứ tự giảm dần là:", "Khí > Lỏng > Rắn.", "Rắn > Lỏng > Khí.", "Lỏng > Rắn > Khí.", "Rắn > Khí > Lỏng.", "B"],
  ["Tại sao xa sân khấu thấy tay trống gõ rồi mới nghe tiếng \"bùm\"?", "Tốc độ ánh sáng lớn hơn rất nhiều tốc độ truyền âm trong không khí.", "Do âm thanh bị cản lại bởi không khí.", "Do tần số âm thanh nhỏ.", "Do trống có độ to không đủ lớn.", "A"],
  ["Khoảng cách an toàn để nghe tiếng vang rõ ràng so với âm gốc cần chênh lệch thời gian tối thiểu:", "$1/10$ giây.", "$1/2$ giây.", "1 giây.", "2 giây.", "A"],
  ["Biện pháp nào sau đây KHÔNG dùng để chống ô nhiễm tiếng ồn?", "Trồng nhiều cây xanh.", "Xây tường nhám, ốp mút xốp cách âm.", "Sử dụng kính hai lớp hút chân không.", "Sơn tường nhà bằng màu sáng.", "D"],
]);

// ============================
// CHƯƠNG 3: ĐIỆN TRƯỜNG (50 câu)
// ============================
const c3s1 = q([
  ["Vật nhiễm điện dương là vật:", "Nhận thêm electron.", "Mất bớt electron.", "Nhận thêm proton.", "Mất bớt proton.", "B"],
  ["Hai điện tích điểm cùng dấu khi đặt gần nhau sẽ:", "Hút nhau.", "Đẩy nhau.", "Không tương tác.", "Có thể hút hoặc đẩy tùy khoảng cách.", "B"],
  ["Độ lớn lực tương tác giữa hai điện tích điểm tỉ lệ nghịch với:", "Tích độ lớn hai điện tích.", "Khoảng cách giữa hai điện tích.", "Bình phương khoảng cách.", "Hằng số điện môi.", "C"],
  ["Công thức định luật Coulomb trong chân không là:", "$F = k|q_1 q_2|/r$", "$F = kq_1 q_2/r^2$", "$F = k|q_1 q_2|/r^2$", "$F = k(q_1+q_2)/r^2$", "C"],
  ["Hằng số $k$ trong định luật Coulomb có giá trị:", "$9.10^9\\ \\text{Nm}^2/\\text{C}^2$", "$9.10^{-9}\\ \\text{Nm}^2/\\text{C}^2$", "$6{,}67.10^{-11}\\ \\text{Nm}^2/\\text{C}^2$", "$1{,}6.10^{-19}\\ \\text{C}$", "A"],
]);
const c3s2 = q([
  ["Điện trường tồn tại xung quanh:", "Một nam châm.", "Một vật chuyển động.", "Một điện tích.", "Một khối lượng.", "C"],
  ["Tính chất cơ bản của điện trường là:", "Tác dụng lực hấp dẫn lên khối lượng.", "Tác dụng lực điện lên điện tích đặt trong nó.", "Tác dụng lực từ lên dòng điện.", "Truyền nhiệt cho vật đặt trong nó.", "B"],
  ["Cường độ điện trường $\\vec{E}$ đặc trưng cho điện trường về phương diện:", "Tác dụng lực.", "Năng lượng.", "Dự trữ điện tích.", "Sinh công.", "A"],
  ["Biểu thức định nghĩa cường độ điện trường là:", "$E = F.q$", "$E = q/F$", "$\\vec{E} = \\vec{F}/q$", "$E = k|q|/r^2$", "C"],
  ["Đơn vị của cường độ điện trường là:", "Vôn (V).", "Vôn trên mét (V/m).", "Newton (N).", "Coulomb (C).", "B"],
]);
const c3s3 = q([
  ["Đường sức điện trường tĩnh KHÔNG có đặc điểm nào?", "Là những đường cong hở.", "Bắt đầu từ điện tích dương, kết thúc ở điện tích âm.", "Có thể cắt nhau tại một điểm.", "Nơi điện trường mạnh thì đường sức dày.", "C"],
  ["Điện trường đều là điện trường có:", "Vectơ $\\vec{E}$ tại mọi điểm đều bằng nhau (cùng hướng, cùng độ lớn).", "Các đường sức là đường cong song song.", "Độ lớn thay đổi theo khoảng cách.", "Các đường sức xuất phát từ vô cực.", "A"],
  ["Vectơ $\\vec{E}$ do điện tích điểm dương gây ra tại một điểm có chiều:", "Hướng về phía điện tích.", "Hướng ra xa điện tích.", "Vuông góc với đường nối điện tích và điểm.", "Quay vòng quanh điện tích.", "B"],
  ["Công thức tính $E$ của điện tích điểm $Q$ trong chân không là:", "$E = k|Q|/r$", "$E = k|Q|/r^2$", "$E = kQ^2/r^2$", "$E = |Q|/r^2$", "B"],
  ["Điện trường giữa hai bản kim loại phẳng song song tích điện trái dấu là:", "Điện trường biến thiên.", "Điện trường đều.", "Điện trường bằng 0.", "Tập trung ở hai mép bản.", "B"],
]);
const c3s4 = q([
  ["Lực điện tác dụng lên điện tích $q$ dương trong điện trường $\\vec{E}$ có hướng:", "Cùng hướng với $\\vec{E}$.", "Ngược hướng với $\\vec{E}$.", "Vuông góc với $\\vec{E}$.", "Hướng về gốc tọa độ.", "A"],
  ["Công của lực điện dịch chuyển điện tích KHÔNG phụ thuộc vào:", "Độ lớn của điện tích $q$.", "Cường độ điện trường.", "Hình dạng của đường đi.", "Vị trí điểm đầu và điểm cuối.", "C"],
  ["Công thức tính công của lực điện trong điện trường đều là:", "$A = qE$", "$A = qEd$", "$A = qE/d$", "$A = Ed/q$", "B"],
  ["Điện tích dịch chuyển theo đường cong khép kín trong điện trường tĩnh, công của lực điện bằng:", "Lớn hơn 0.", "Nhỏ hơn 0.", "Bằng 0.", "Phụ thuộc vào loại điện tích.", "C"],
  ["Đại lượng $d$ trong công thức $A = qEd$ là:", "Quãng đường thực tế.", "Hình chiếu của độ dời lên phương đường sức điện.", "Khoảng cách ngắn nhất từ điểm đầu đến điểm cuối.", "Độ dài đường sức.", "B"],
]);
const c3s5 = q([
  ["Thế năng của điện tích $q$ tại điểm M đặc trưng cho:", "Khả năng tác dụng lực của điện trường.", "Khả năng sinh công của điện trường tại điểm đó.", "Vận tốc của điện tích.", "Khối lượng của điện tích.", "B"],
  ["Công thức liên hệ công lực điện và độ giảm thế năng là:", "$A_{MN} = W_M - W_N$", "$A_{MN} = W_N - W_M$", "$A_{MN} = W_M + W_N$", "$A_{MN} = W_M/W_N$", "A"],
  ["Điện thế $V$ tại một điểm đặc trưng cho điện trường về phương diện:", "Tác dụng lực.", "Tạo ra dòng điện.", "Tạo ra điện tích.", "Thế năng điện tại điểm đó.", "D"],
  ["Công thức định nghĩa điện thế tại điểm M là:", "$V_M = A_{M\\infty}/q$", "$V_M = A_{M\\infty}.q$", "$V_M = q/A_{M\\infty}$", "$V_M = qEd$", "A"],
  ["Điện thế là đại lượng:", "Có hướng (vectơ).", "Vô hướng, luôn dương.", "Vô hướng, có thể dương, âm hoặc bằng 0.", "Luôn bằng 0.", "C"],
]);
const c3s6 = q([
  ["Hiệu điện thế giữa hai điểm M, N được xác định bằng:", "$U_{MN} = V_M + V_N$", "$U_{MN} = V_M - V_N$", "$U_{MN} = V_N - V_M$", "$U_{MN} = V_M.V_N$", "B"],
  ["Đơn vị của hiệu điện thế là:", "Vôn/mét (V/m).", "Ampe (A).", "Coulomb (C).", "Vôn (V).", "D"],
  ["Mối liên hệ giữa $E$ đều và $U$ giữa hai điểm cách nhau $d$ dọc theo đường sức là:", "$U = E/d$", "$E = U/d$", "$E = U.d$", "$E = d/U$", "B"],
  ["Công của lực điện dịch chuyển $q$ từ M đến N:", "$A_{MN} = q(V_N - V_M)$", "$A_{MN} = qU_{MN}$", "$A_{MN} = U_{MN}/q$", "$A_{MN} = q/U_{MN}$", "B"],
  ["Electron dịch chuyển ngược chiều đường sức điện trường, lực điện sinh công:", "Dương.", "Âm.", "Bằng 0.", "Không xác định.", "A"],
]);
const c3s7 = q([
  ["Tụ điện là hệ gồm:", "Hai vật dẫn đặt gần nhau và ngăn cách bởi lớp cách điện.", "Hai vật dẫn tiếp xúc nhau.", "Hai vật cách điện đặt gần nhau.", "Một vật dẫn và một vật cách điện.", "A"],
  ["Đại lượng đặc trưng khả năng tích điện của tụ ở một hiệu điện thế là:", "Điện thế.", "Cường độ điện trường.", "Điện dung.", "Năng lượng điện trường.", "C"],
  ["Công thức tính điện dung của tụ điện là:", "$C = Q.U$", "$C = U/Q$", "$C = Q/U$", "$C = Q^2 U$", "C"],
  ["Đơn vị của điện dung là:", "Vôn (V).", "Fara (F).", "Coulomb (C).", "Henry (H).", "B"],
  ["Trên vỏ tụ ghi $20\\mu F - 200V$. Số liệu $200V$ cho biết:", "Hiệu điện thế tối thiểu phải đặt vào.", "Hiệu điện thế định mức (giới hạn).", "Hiệu điện thế luôn tồn tại.", "Nguồn điện tạo ra tụ.", "B"],
]);
const c3s8 = q([
  ["Khi tụ điện nạp điện, năng lượng tích lũy dưới dạng:", "Năng lượng từ trường.", "Năng lượng điện trường.", "Năng lượng cơ học.", "Hóa năng.", "B"],
  ["Công thức tính năng lượng của tụ điện là:", "$W = CU^2/2$", "$W = CU^2$", "$W = C^2 U/2$", "$W = QU^2/2$", "A"],
  ["Ghép nối tiếp $C_1$ và $C_2$, điện dung tương đương:", "$C_b = C_1 + C_2$", "$1/C_b = 1/C_1 + 1/C_2$", "$C_b = C_1.C_2$", "$C_b = |C_1 - C_2|$", "B"],
  ["Ghép song song $C_1$ và $C_2$, điện dung tương đương:", "$C_b = C_1 + C_2$", "$1/C_b = 1/C_1 + 1/C_2$", "$C_b = C_1 C_2/(C_1+C_2)$", "$C_b = C_1/C_2$", "A"],
  ["Ứng dụng phổ biến nhất của tụ điện trong kĩ thuật:", "Tạo ra dòng điện một chiều.", "Tạo nhiệt lượng.", "Lưu trữ năng lượng và lọc tín hiệu điện tử.", "Thay thế biến trở.", "C"],
]);
const c3s9 = q([
  ["Electron thả không vận tốc vào điện trường đều. Electron chuyển động:", "Đứng yên.", "Nhanh dần đều dọc theo chiều đường sức điện.", "Nhanh dần đều ngược chiều đường sức điện.", "Tròn đều.", "C"],
  ["Gia tốc điện tích $q$ khối lượng $m$ trong điện trường $E$ (bỏ qua trọng lực):", "$a = qE/m$", "$a = |q|E/m$", "$a = m/(|q|E)$", "$a = |q|Em$", "B"],
  ["Hạt bụi điện tích âm bay ngang vào giữa tụ điện (bản dương ở trên). Bỏ qua trọng lực, quỹ đạo:", "Thẳng đi xuống.", "Thẳng đi lên.", "Parabol uốn về phía bản dương.", "Parabol uốn về phía bản âm.", "C"],
  ["Để hạt bụi mang điện lơ lửng giữa hai bản tụ, lực điện phải có hướng:", "Từ trái sang phải.", "Từ phải sang trái.", "Thẳng đứng xuống dưới.", "Thẳng đứng lên trên.", "D"],
  ["Máy dao động kí điều khiển chùm electron dựa trên nguyên tắc:", "Làm lệch quỹ đạo hạt bằng điện trường hoặc từ trường.", "Giao thoa ánh sáng.", "Phản xạ sóng cơ học.", "Tán sắc ánh sáng.", "A"],
]);
const c3s10 = q([
  ["Tăng khoảng cách hai điện tích lên 2 lần, lực tương tác:", "Tăng 2 lần.", "Giảm 2 lần.", "Tăng 4 lần.", "Giảm 4 lần.", "D"],
  ["Nếu $r$ giảm đi một nửa, cường độ điện trường tại điểm đó:", "Tăng 2 lần.", "Giảm 2 lần.", "Tăng 4 lần.", "Giảm 4 lần.", "C"],
  ["Công của lực điện khi điện tích di chuyển vòng kín trong điện trường đều bằng:", "$qEd$", "$qE(2\\pi R)$", "$0$", "$-qEd$", "C"],
  ["Năng lượng tụ $C = 2\\mu F$ tích điện đến $U = 10V$ là:", "$10^{-4}\\ \\text{J}$", "$10^{-5}\\ \\text{J}$", "$2.10^{-4}\\ \\text{J}$", "$10\\ \\text{J}$", "A"],
  ["Đại lượng nào sau đây là đại lượng vectơ?", "Điện dung.", "Điện thế.", "Hiệu điện thế.", "Cường độ điện trường.", "D"],
]);

// ===========================================
// CHƯƠNG 4: DÒNG ĐIỆN & MẠCH ĐIỆN (50 câu)
// ===========================================
const c4s1 = q([
  ["Dòng điện là dòng chuyển dời có hướng của các:", "Phân tử.", "Nguyên tử.", "Hạt mang điện.", "Lỗ trống.", "C"],
  ["Chiều quy ước của dòng điện là chiều chuyển động của:", "Các electron.", "Các điện tích dương.", "Các ion âm.", "Các nguyên tử.", "B"],
  ["Cường độ dòng điện $I$ đặc trưng cho:", "Chiều của dòng điện.", "Mức độ mạnh yếu của dòng điện.", "Khả năng cản trở dòng điện.", "Khả năng sinh công của nguồn.", "B"],
  ["Biểu thức định nghĩa cường độ dòng điện không đổi:", "$I = \\Delta q/\\Delta t$", "$I = q.\\Delta t$", "$I = \\Delta t/\\Delta q$", "$I = U/R$", "A"],
  ["Số electron qua tiết diện thẳng trong thời gian $t$ được tính bằng:", "$n = It/e$", "$n = Ie/t$", "$n = I.t.e$", "$n = e/(It)$", "A"],
]);
const c4s2 = q([
  ["Nguồn điện có tác dụng:", "Tạo ra điện tích mới.", "Duy trì hiệu điện thế giữa hai cực.", "Tiêu thụ điện năng.", "Làm tăng điện trở mạch.", "B"],
  ["Bên trong nguồn điện, lực lạ có tác dụng:", "Làm di chuyển điện tích dương từ cực dương sang cực âm.", "Làm di chuyển điện tích dương từ cực âm sang cực dương.", "Đẩy electron từ cực âm về cực dương.", "Triệt tiêu lực điện trường.", "B"],
  ["Đặc trưng cho khả năng thực hiện công của lực lạ trong nguồn điện là:", "Suất điện động.", "Cường độ dòng điện.", "Điện trở trong.", "Hiệu điện thế mạch ngoài.", "A"],
  ["Công thức định nghĩa suất điện động $\\mathcal{E}$ là:", "$\\mathcal{E} = q/A$", "$\\mathcal{E} = A.q$", "$\\mathcal{E} = A/q$", "$\\mathcal{E} = I(R+r)$", "C"],
  ["Đơn vị của suất điện động là:", "Ampe (A).", "Coulomb (C).", "Oát (W).", "Vôn (V).", "D"],
]);
const c4s3 = q([
  ["Điện năng tiêu thụ của đoạn mạch bằng:", "Công của lực lạ làm di chuyển điện tích.", "Công của lực điện trường khi dịch chuyển điện tích tự do trong đoạn mạch.", "Nhiệt lượng tỏa ra trên đoạn mạch.", "Suất điện động của đoạn mạch.", "B"],
  ["Công thức tính điện năng tiêu thụ $A$ của đoạn mạch:", "$A = UIt$", "$A = UI/t$", "$A = UI^2 t$", "$A = U^2/R$", "A"],
  ["Công suất điện đặc trưng cho:", "Tốc độ sinh công lạ.", "Tốc độ tiêu thụ điện năng.", "Khả năng giữ nhiệt.", "Điện trở mạch.", "B"],
  ["Công thức tính công suất điện $P$ của đoạn mạch:", "$P = U/I$", "$P = UI$", "$P = UIt$", "$P = I^2 Rt$", "B"],
  ["Bóng đèn $220V - 100W$. Điện trở của bóng khi sáng bình thường:", "$2{,}2\\ \\Omega$", "$484\\ \\Omega$", "$2200\\ \\Omega$", "$0{,}45\\ \\Omega$", "B"],
]);
const c4s4 = q([
  ["Định luật Joule-Lenz nói về chuyển hóa điện năng thành:", "Cơ năng.", "Hóa năng.", "Quang năng.", "Nhiệt năng.", "D"],
  ["Công thức Joule-Lenz tính nhiệt lượng $Q$ tỏa ra trên vật dẫn điện trở $R$:", "$Q = UI$", "$Q = RIt$", "$Q = I^2 Rt$", "$Q = U^2/R$", "C"],
  ["Công của nguồn điện trong toàn mạch bằng:", "Điện năng tiêu thụ ở mạch ngoài.", "Nhiệt lượng tỏa ra ở điện trở trong.", "Tổng điện năng tiêu thụ ở mạch ngoài và mạch trong.", "Suất điện động của nguồn.", "C"],
  ["Công suất của nguồn điện $\\mathcal{E}$ phát ra dòng điện $I$ là:", "$P_n = UI$", "$P_n = \\mathcal{E}I$", "$P_n = I^2 r$", "$P_n = \\mathcal{E}/I$", "B"],
  ["Đơn vị đo điện năng trên công tơ điện thường dùng là:", "Jun (J).", "Kilowatt (kW).", "Kilowatt giờ (kWh).", "Vôn ampe (VA).", "C"],
]);
const c4s5 = q([
  ["Định luật Ohm toàn mạch: cường độ tỉ lệ thuận với suất điện động và:", "Tỉ lệ thuận với điện trở toàn phần.", "Tỉ lệ nghịch với điện trở mạch ngoài.", "Tỉ lệ nghịch với điện trở toàn phần.", "Tỉ lệ thuận với hiệu điện thế mạch ngoài.", "C"],
  ["Biểu thức định luật Ohm toàn mạch:", "$I = U/R$", "$I = \\mathcal{E}/(R_N+r)$", "$\\mathcal{E} = I.R_N$", "$I = \\mathcal{E}(R_N+r)$", "B"],
  ["Hiệu điện thế hai đầu mạch ngoài $U_N$ được tính bằng:", "$U_N = IR_N$ hoặc $U_N = \\mathcal{E} - Ir$", "$U_N = \\mathcal{E} + Ir$", "$U_N = I(R_N+r)$", "$U_N = \\mathcal{E}/R_N$", "A"],
  ["Khi mạch ngoài hở ($R_N \\to \\infty$), hiệu điện thế hai đầu nguồn bằng:", "Bằng 0.", "Bằng cường độ dòng điện.", "Bằng suất điện động $\\mathcal{E}$.", "Bằng điện trở trong $r$.", "C"],
  ["Hiện tượng sụt áp bên trong nguồn xảy ra do:", "Lực lạ không hoạt động.", "Điện trở mạch ngoài quá lớn.", "Dòng điện chạy qua điện trở trong ($Ir$).", "Mạch bị hở.", "C"],
]);
const c4s6 = q([
  ["Hiện tượng đoản mạch xảy ra khi:", "Nối hai cực nguồn bằng dây dẫn điện trở rất nhỏ.", "Mở công tắc mạch điện.", "Thêm nhiều điện trở vào mạch.", "Cường độ dòng điện bằng 0.", "A"],
  ["Khi bị đoản mạch, cường độ trong mạch sẽ:", "Đạt giá trị nhỏ nhất.", "Đạt giá trị lớn nhất $I_{max} = \\mathcal{E}/r$.", "Bằng 0.", "Không thay đổi.", "B"],
  ["Hiệu suất nguồn điện $H$ được tính:", "$H = (U_N/\\mathcal{E}).100\\%$", "$H = (\\mathcal{E}/U_N).100\\%$", "$H = (r/(R_N+r)).100\\%$", "$H = (Ir/\\mathcal{E}).100\\%$", "A"],
  ["Hiệu suất nguồn tiến tới 100% khi:", "Làm đoản mạch.", "$r$ rất lớn so với $R_N$.", "$R_N$ rất lớn so với $r$.", "$\\mathcal{E}$ tiến tới 0.", "C"],
  ["Tác hại nghiêm trọng nhất của đoản mạch là:", "Đèn sáng yếu.", "Tốn ít điện hơn.", "Dòng điện tăng vọt, tỏa nhiệt mạnh gây hỏa hoạn.", "Tăng tuổi thọ nguồn điện.", "C"],
]);
const c4s7 = q([
  ["Định luật Ohm cho đoạn mạch chỉ chứa điện trở thuần:", "$I = U.R$", "$I = U/R$", "$U = I/R$", "$R = U.I$", "B"],
  ["Ghép nối tiếp $R_1$ và $R_2$, điện trở tương đương:", "$R_b = R_1 + R_2$", "$1/R_b = 1/R_1 + 1/R_2$", "$R_b = |R_1 - R_2|$", "$R_b = R_1 R_2/(R_1+R_2)$", "A"],
  ["Đặc điểm của mạch mắc nối tiếp:", "Cường độ qua các điện trở khác nhau.", "Hiệu điện thế bằng hiệu điện thế mỗi điện trở.", "Cường độ bằng nhau: $I = I_1 = I_2$.", "Điện trở tương đương nhỏ hơn các thành phần.", "C"],
  ["Ghép song song $R_1$ và $R_2$, điện trở tương đương:", "$R_b = R_1 + R_2$", "$R_b = R_1 R_2/(R_1+R_2)$", "$R_b = R_1.R_2$", "$R_b = (R_1+R_2)/(R_1 R_2)$", "B"],
  ["Trong đoạn mạch song song $R_1$ và $R_2$, dòng điện rẽ nhánh theo tỉ lệ:", "$I_1/I_2 = R_1/R_2$", "$I_1/I_2 = R_2/R_1$", "$I_1 = I_2$", "Không theo quy luật.", "B"],
]);
const c4s8 = q([
  ["Ampe kế dùng để đo:", "Hiệu điện thế.", "Điện trở.", "Suất điện động.", "Cường độ dòng điện.", "D"],
  ["Đo cường độ qua bóng đèn, Ampe kế phải mắc:", "Song song với bóng đèn.", "Nối tiếp với bóng đèn.", "Nối tiếp với nguồn, nhánh khác đèn.", "Cách nào cũng được.", "B"],
  ["Ampe kế lí tưởng có điện trở:", "Rất lớn (tiến tới vô cùng).", "Rất nhỏ (bằng 0).", "Bằng điện trở mạch ngoài.", "Bằng điện trở trong của nguồn.", "B"],
  ["Vôn kế dùng để đo:", "Cường độ dòng điện.", "Điện trở.", "Hiệu điện thế.", "Công suất tỏa nhiệt.", "C"],
  ["Vôn kế phải được mắc:", "Nối tiếp với đoạn mạch cần đo.", "Song song với đoạn mạch cần đo.", "Chỉ mắc ở mạch chính.", "Trước công tắc.", "B"],
]);
const c4s9 = q([
  ["Mạch ngoài: $R_1 = 3\\Omega$ nối tiếp $R_2 = 6\\Omega$. Điện trở tương đương:", "$2\\ \\Omega$", "$9\\ \\Omega$", "$18\\ \\Omega$", "$3\\ \\Omega$", "B"],
  ["Nguồn $\\mathcal{E} = 12V$, $r = 1\\Omega$, $R = 5\\Omega$. Cường độ trong mạch:", "$12\\ A$", "$2\\ A$", "$2{,}4\\ A$", "$6\\ A$", "B"],
  ["Câu trên: công suất tiêu thụ trên $R$ là:", "$24\\ W$", "$20\\ W$", "$12\\ W$", "$5\\ W$", "B"],
  ["Để tăng hiệu điện thế hai đầu mạch ngoài, ta cần:", "Tăng điện trở trong $r$.", "Tăng điện trở mạch ngoài $R_N$.", "Làm đoản mạch nguồn.", "Giảm suất điện động.", "B"],
  ["Ắc quy dung lượng $10\\ Ah$. Khẳng định đúng:", "Phát 10A liên tục mãi mãi.", "Cung cấp điện lượng tổng $36000\\ C$.", "Điện trở của ắc quy là $10\\ \\Omega$.", "Công suất ắc quy là $10\\ W$.", "B"],
]);
const c4s10 = q([
  ["Dòng điện không đổi là dòng điện có:", "Chiều không thay đổi.", "Chiều và cường độ không thay đổi theo thời gian.", "Cường độ tăng giảm tuần hoàn.", "Hiệu điện thế không đổi nhưng cường độ thay đổi.", "B"],
  ["Điều kiện để có dòng điện là phải có:", "Hạt mang điện.", "Hiệu điện thế.", "Dây dẫn và nguồn điện.", "Các hạt mang điện tự do và hiệu điện thế đặt vào hai đầu vật dẫn.", "D"],
  ["Nếu $R_1$ song song $R_2$ và $R_1 > R_2$ thì $R_{td}$:", "Lớn hơn $R_1$.", "Nằm giữa $R_1$ và $R_2$.", "Nhỏ hơn $R_2$.", "Bằng trung bình cộng.", "C"],
  ["Ghép hai bóng $3V - 3W$ nối tiếp vào nguồn $6V$ (bỏ $r$). Hai đèn sáng:", "Yếu hơn bình thường.", "Rất sáng và cháy.", "Bình thường.", "Không sáng.", "C"],
  ["Thiết bị nào sau đây dựa trên tác dụng nhiệt của dòng điện?", "Cầu chì.", "Động cơ quạt.", "Chuông điện.", "Bình điện phân.", "A"],
]);

// Câu hỏi chìa khóa (end game)
const keyQuestions = [
  {
    question: "🗝️ CÂU HỎI CHÌA KHÓA: Một vật dao động điều hòa. Khi động năng gấp 3 lần thế năng thì li độ $x$ bằng bao nhiêu (với $A$ là biên độ)?",
    options: { A: "$x = \\pm A/2$", B: "$x = \\pm A\\sqrt{3}/2$", C: "$x = \\pm A\\sqrt{2}/2$", D: "$x = \\pm A/\\sqrt{3}$" },
    answer: "A"
  },
  {
    question: "🗝️ CÂU HỎI CHÌA KHÓA: Đặt điện tích $Q$ vào môi trường có hằng số điện môi $\\varepsilon$. Cường độ điện trường so với trong chân không sẽ:",
    options: { A: "Tăng $\\varepsilon$ lần", B: "Giảm $\\varepsilon$ lần", C: "Không thay đổi", D: "Tăng $\\varepsilon^2$ lần" },
    answer: "B"
  },
  {
    question: "🗝️ CÂU HỎI CHÌA KHÓA: Nguồn điện có $\\mathcal{E} = 9V$, $r = 1\\Omega$. Mắc ngoài $R = 2\\Omega$. Hiệu suất của nguồn là:",
    options: { A: "50%", B: "66,7%", C: "75%", D: "80%" },
    answer: "B"
  },
  {
    question: "🗝️ CÂU HỎI CHÌA KHÓA: Sóng dừng trên dây dài $L$, hai đầu cố định, tốc độ truyền sóng $v$. Tần số dao động nhỏ nhất (cơ bản) là:",
    options: { A: "$f = v/L$", B: "$f = v/(4L)$", C: "$f = v/(2L)$", D: "$f = 2v/L$" },
    answer: "C"
  }
];


module.exports = {
  // ── Dữ liệu câu hỏi ───────────────────────────────────────────────────────
  chapter1:     { name: 'Dao động',              stages: [c1s1, c1s2, c1s3, c1s4, c1s5, c1s6, c1s7, c1s8, c1s9, c1s10] },
  chapter2:     { name: 'Sóng',                  stages: [c2s1, c2s2, c2s3, c2s4, c2s5, c2s6, c2s7, c2s8, c2s9, c2s10] },
  chapter3:     { name: 'Điện trường',           stages: [c3s1, c3s2, c3s3, c3s4, c3s5, c3s6, c3s7, c3s8, c3s9, c3s10] },
  chapter4:     { name: 'Dòng điện & Mạch điện', stages: [c4s1, c4s2, c4s3, c4s4, c4s5, c4s6, c4s7, c4s8, c4s9, c4s10] },
  keyQuestions,

  // ── KaTeX helpers ──────────────────────────────────────────────────────────
  renderTeX,       // renderTeX(text [, katexInstance]) → HTML string
  renderQuestion,  // renderQuestion(q [, katexInstance]) → rendered question
};
