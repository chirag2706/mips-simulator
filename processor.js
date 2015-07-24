var processor = {
	running: true,
	stackSize: 1024,
	memorySize: 4*1024,
	memoryPointer: 0,
	instrLabels: {},
	dataLabels: {},
	data: [],
	text: [],

	registers: new DataView(new ArrayBuffer(32*4)),

	registerNames: {
		"v0":2,
		"v1":3,
		"a0":4,
		"a1":5,
		"a2":6,
		"a3":7,
		"t0":8,
		"t1":9,
		"t2":10,
		"t3":11,
		"t4":12,
		"t5":13,
		"t6":14,
		"t7":15,
		"t8":24,
		"t9":25,
		"s0":16,
		"s1":17,
		"s2":18,
		"s3":19,
		"s4":20,
		"s5":21,
		"s6":22,
		"s7":23,
		"s8":30,
		"k0":26,
		"k1":27,
		"gp":28,
		"sp":29,
		"ra":31,
	},

	programCounter: 0,
};

processor.setRegister = function(reg,num) {
	reg = reg.substring(1);
	if(reg.match(/\D/)) {
		reg = processor.registerNames[reg];
	}
	else {
		reg = parseInt(reg);
	}

	processor.registers.setUint32(reg*4,num);
};

processor.getRegister = function(reg, numBytes) {
	//by default, get the whole word
	numBytes = numBytes|4;

	//remove the dollar sign
	reg = reg.substring(1);
	if(reg.match(/\D/)) {
		reg = processor.registerNames[reg];
	}
	else {
		reg = parseInt(reg);
	}

	switch(numBytes) {
		case 1:
			return processor.registers.getUint8(reg*4);
		case 2:
			return processor.registers.getUint16(reg*4);
		case 4:
			return processor.registers.getUint32(reg*4);
	}
};

processor.operations =  {

	//arithmetic
	abs: function(dest, src) {
		//STUB
	},
	add: function(dest, src1, src2) {
		processor.setRegister(dest,processor.getRegister(src1)+processor.secondSourceIntValue(src2));
	},
	addu: function(dest, src1, src2) {
		processor.operations.add(dest, src1, src2);
	},
	sub: function(dest, src1, src2) {
		processor.setRegister(dest,processor.getRegister(src1)-processor.secondSourceIntValue(src2));
	},
	addi: function(dest, src, num) {
		processor.setRegister(dest,processor.getRegister(src)+parseInt(num));
	},
	mul: function(dest, src1, src2) {
		processor.setRegister(dest,processor.getRegister(src1)*processor.secondSourceIntValue(src2));
	},

	//load
	la: function(dest, address) {
		processor.setRegister(dest,processor.addressToOffset(address));
	},
	lb: function(dest, address) {
		processor.setRegister(dest,processor.memoryView.getUint8(processor.addressToOffset(address)));
	},
	lw: function(dest, address) {
		//return if the address is not aligned
		if(address%2) return;
		processor.setRegister(dest,processor.memoryView.getUint32(processor.addressToOffset(address)));
	},
	li: function(dest,num) {
		processor.setRegister(dest,parseInt(num));
	},


	//data movement
	move: function(dest,src) {
		processor.setRegister(dest,processor.getRegister(src)); 
	},


	//jump
	j: function(label) {
		processor.programCounter = processor.instrLabels[label]-1;
	},
	jal: function(label) {
		processor.setRegister("$ra",processor.programCounter+1);
		processor.programCounter = processor.instrLabels[label]-1;
	},
	jalr: function(reg) {
		processor.setRegister("$ra",processor.programCounter+1);
		processor.programCounter = processor.getRegister(reg)-1;
	},
	jr: function(reg) {
		processor.programCounter = processor.getRegister("$ra")-1;
	},

	//branch
	beq: function(src1, src2, label) {
		if(processor.getRegister(src1)==processor.secondSourceIntValue(src2))
			processor.programCounter = processor.instrLabels[label]-1;
	},
	beqz: function(src, label) {
		if(processor.getRegister(src)==0) {
			processor.programCounter = processor.instrLabels[label]-1;
		}
	},
	bge: function(src1, src2, label) {
		if(processor.getRegister(src1)>=processor.secondSourceIntValue(src2)) {
			processor.programCounter = processor.instrLabels[label]-1;
		}
	},
	bgt: function(src1, src2, label) {
		if(processor.getRegister(src1)>processor.secondSourceIntValue(src2)) {
			processor.programCounter = processor.instrLabels[label]-1;
		}
	},
	bne: function(src1, src2, label) {
		if(processor.getRegister(src1)!=processor.secondSourceIntValue(src2)) {
			processor.programCounter = processor.instrLabels[label]-1;
		}
	},
	b: function(label) {
		processor.programCounter = processor.instrLabels[label]-1;
	},

	//store
	sb: function(src1, address) {
		address = processor.addressToOffset(address);
		processor.memoryView.setUint8(address, processor.getRegister(src1,1));
	},
	sh: function(src1, address) {
		//return if the address is not aligned
		if(address%2) return;
		address = processor.addressToOffset(address);
		processor.memoryView.setUint8(address, processor.getRegister(src1,2));
	},
	sw: function(src1, address) {
		//return if the address is not aligned
		if(address%4) return;
		address = processor.addressToOffset(address);
		processor.memoryView.setUint8(address, processor.getRegister(src1,4));
	},
	swl: function(src1, address) {
		address = processor.addressToOffset(address);
		upperHalfWord = processor.getRegister(src1,4)%Math.pow(2,16);
	},
	swr: function (src1, address) {
		address = processor.addressToOffset(address);
		processor.memoryView.setUint8(address, processor.getRegister(src1,2));
	},

	//all syscalls use this function
	syscall: function() {
		processor.syscalls[processor.getRegister("$v0")]();
	}
};

processor.syscalls =  {
	//syscall 1 prints the int in $a0
	1: function() { 
		system.printInt(processor.getRegister("$a0"));
	},
	//syscall 4 prints the null-terminated string pointed to by the address in $a0
	4: function() {
		system.printString(unescape(processor.retrieveString(processor.getRegister("$a0"))));
	},
	//syscall 5 reads an int into $v0
	5: function() {
		system.readInt();
	},
	//syscall 8 reads a string and stores it in the address stored by $a0
	8: function() {
		system.readString();
	},
	//syscall 10 ends the program
	10: function() { processor.running = false;},
	//syscall 11 prints the character in $a0
	11: function() { 
		system.printChar(processor.getRegister("$a0"));
	},
};

processor.runInstr = function() {

	if(!processor.running) return;

	instr = processor.text[processor.programCounter];

	if(processor.operations[instr["op"]]!=undefined) {
		processor.operations[instr["op"]].apply(this,instr["params"]);
	}
	processor.programCounter++;

	console.log("pc: "+processor.programCounter);
	console.log("text length: "+this.text.length.toString());
	if(processor.programCounter>=this.text.length&&this.running) {
		system.printString("ERROR: reached end of instructions.");
		this.running = false;
		pause();
	}
};

processor.reset = function() {
	this.registers= new DataView(new ArrayBuffer(32*8));
	this.stack = new ArrayBuffer(processor.stackSize);
	this.stackView = new DataView(this.stack);
	this.setRegister("$sp",this.stackSize);
	this.memory = new ArrayBuffer(this.memorySize);
	this.memoryView = new DataView(this.memory);
};

processor.loadData = function(data) {
	switch(data.type) {

		case "asciiz":
			nullTerminated = true;
		case "ascii":
			str = data.data[0].substring(1, data.data[0].length-1);
			str = str.replace(/\\n/g, String.fromCharCode(10));
			processor.loadString(processor.memoryPointer,str);
			processor.memoryPointer+=str.length+1;
			if (nullTerminated) processor.memoryPointer++;
			break;

		case "byte":
			data.data.forEach(function(b) {
				processor.memoryView.setUint8(processor.memoryPointer,parseInt(b));
				processor.memoryPointer++;
			});
			break;

		case "halfword":
			
			break;

		case "word":
			console.log("storing words");
			console.log(data.data);
			data.data.forEach(function(w) {
				processor.memoryView.setUint32(processor.memoryPointer,parseInt(w));
				processor.memoryPointer+=4;
			});
			break;

		case "space":
			processor.memoryPointer+=parseInt(data.data);
			break;
	}
};

processor.loadString = function(address, str) {
	str.split("").forEach(function(ch, ind) {
		processor.memoryView.setUint8(address+ind,
			ch.charCodeAt(0));
	});
	processor.memoryView.setUint8(address+str.length,0);
},

processor.retrieveString = function(offset) {
	str = "";
	b = processor.memoryView.getUint8(offset);
	for(i = 0; b != 0; i++) {
		b = processor.memoryView.getUint8(offset+i);
		str = str + String.fromCharCode(b);
	}
	return unescape(str);
};

processor.addressToOffset = function(addressStr) {
	if (addressStr.match(/^\d+$/)&&!addressStr.match(/\+/)) {
		console.log("const");
		return parseInt(addressStr);
	}
	if (addressStr.match(/^\(\$\w+\)$/)) {
		console.log("($register)");
		return processor.getRegister(addressStr.substring(1,addressStr.length-1));
	}
	if (addressStr.match(/^\d\d*\(\$\w+\)$/)) {
		console.log("const($reg)");
		num = parseInt(addressStr.split("(")[0]);
		reg = addressStr.split("(")[1].split(")")[0];
		return num + processor.getRegister(reg);
	}
	if (addressStr.match(/^\w+$/)) {
		console.log("label");
		return processor.dataLabels[addressStr];
	}
	if (addressStr.match(/^\w+\s*\+\s*\d+$/m)) {
		console.log("label + const");
		label = addressStr.split(/\s*\+\s*/)[0];
		num = parseInt(addressStr.split(/\+\s*/)[1]);
		return processor.dataLabels[label]+num;
	}
	if (addressStr.match(/^\w+\s*\+\s*\d+\(\$\w+\)/m)) {
		console.log("label + const($reg)");
		label = addressStr.split(/\s*\+\s*/)[0];
		num = parseInt(addressStr.split(/\+\s*/)[1].split("(")[0]);
		reg = reg = addressStr.split("(")[1].split(")")[0];
		return processor.dataLabels[label] + num + processor.getRegister(reg);
	}
	return "something went wrong.";
};

processor.labelMemory = function(label) {
	processor.dataLabels[label] = processor.memoryPointer;
};

processor.labelInstr = function(label) {
	processor.instrLabels[label] = processor.text.length;
};

/* for arithmetic and comparisons,
the last operand can be a character,
an integer, or a register.
*/
processor.secondSourceIntValue = function(src2) {
	console.log("src2: "+src2);
	if(src2.indexOf("$")>-1)
		return processor.getRegister(src2);
	if(src2.match(/'.'/)) {
		return src2.charCodeAt(1);
	}
	else return parseInt(src2);
};

processor.init = function() {
	processor.registers = new DataView(new ArrayBuffer(32*8));
	processor.dataLabels = [];
	processor.instrLabels = [];
	processor.programCounter = 0;
	processor.memoryPointer = 0;
	processor.setRegister("$sp", processor.memorySize);
	processor.running = true;
};
